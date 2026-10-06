"use client";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import Aviso from "@/components/ui/Aviso";
import Botao from "@/components/ui/Botao";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Cartao from "@/components/ui/Cartao";
import Selo from "@/components/ui/Selo";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useProdutos } from "@/hooks/useProdutos";
import { api } from "@/lib/apiClient";
import { formatMoeda, formatQuantidade } from "@/lib/calc";
import { lerPlanilha, linhasDeMatriz, type LinhaImportacao } from "@/lib/importacao";

const LOTE = 100; // igual ao limite do servidor
const MAX_BYTES = 5_000_000;

// CSV do Excel em português costuma vir em Windows-1252; tenta UTF-8 e cai para ele.
function decodificar(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export default function ImportarProdutos() {
  const { ehDono } = useAuth();
  const toast = useToast();
  const { dados: existentes } = useProdutos();
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [chave, setChave] = useState(0); // troca para limpar o campo de arquivo

  const codigosExistentes = useMemo(() => new Set(existentes.map((p) => p.codigo)), [existentes]);
  const validas = linhas.filter((l) => l.dados);

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    setLinhas([]);
    setResultado("");
    setErro("");
    if (!arq) return;
    if (/\.xls$/i.test(arq.name)) {
      return setErro("Excel antigo (.xls) não é lido. No Excel: Arquivo > Salvar como > Pasta de Trabalho do Excel (.xlsx) ou CSV.");
    }
    if (arq.size > MAX_BYTES) return setErro("Arquivo muito grande (limite de 5 MB). Divida a planilha em partes.");
    let dados: Record<string, string>[];
    try {
      if (/\.xlsx$/i.test(arq.name)) {
        dados = linhasDeMatriz(await readSheet(arq)); // primeira aba, primeira linha = cabeçalho
      } else {
        dados = Papa.parse<Record<string, string>>(decodificar(await arq.arrayBuffer()), { header: true, skipEmptyLines: true }).data;
      }
    } catch {
      return setErro("Não consegui ler esse arquivo. Confira se é um .xlsx ou CSV válido.");
    }
    if (!dados.length) return setErro("A planilha está vazia.");
    const { linhas: l, faltando } = lerPlanilha(dados);
    if (faltando.length) return setErro(`Faltam colunas: ${faltando.join(", ")}. Veja o modelo abaixo.`);
    setLinhas(l);
  }

  function cancelar() {
    setLinhas([]);
    setErro("");
    setResultado("");
    setChave((c) => c + 1);
  }

  async function importar() {
    setEnviando(true);
    setErro("");
    let criados = 0;
    let atualizados = 0;
    try {
      for (let i = 0; i < validas.length; i += LOTE) {
        const r = await api<{ criados: number; atualizados: number }>("/api/produtos/importar", {
          linhas: validas.slice(i, i + LOTE).map((l) => l.dados),
        });
        criados += r.criados;
        atualizados += r.atualizados;
      }
      setResultado(`Pronto: ${criados} criado(s) e ${atualizados} atualizado(s).`);
      setLinhas([]);
      toast("Importação concluída.");
    } catch (err) {
      // lotes anteriores já foram gravados; reimportar é seguro (código existente só atualiza)
      setErro(`${(err as Error).message}. ${criados + atualizados} produto(s) já tinham sido salvos; pode reenviar a planilha.`);
    } finally {
      setEnviando(false);
    }
  }

  if (!ehDono) return <Aviso>Só o dono importa produtos.</Aviso>;

  return (
    <>
      <CabecalhoPagina
        titulo="Importar produtos"
        subtitulo="Envie uma planilha Excel (.xlsx) ou CSV, confira e só então salve."
        acoes={<Link href="/produtos" className="inline-flex min-h-10 items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100">Voltar</Link>}
      />
      <div className="space-y-4">
        <Cartao titulo="1. Escolha o arquivo">
          <input key={chave} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={escolher} aria-label="Arquivo da planilha (.xlsx ou CSV)" className="block w-full cursor-pointer rounded-md border-2 border-dashed border-gray-300 bg-gray-100 p-4 text-sm text-gray-700 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-5 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:border-primary hover:file:bg-primary/90" />
          <p className="mt-3 text-sm text-gray-600">
            Primeira aba, primeira linha com os nomes das colunas. Colunas: <b>codigo</b>, <b>nome</b>, <b>preco</b> (obrigatórias) e categoria, marca, unidade (un, m, rolo, cx, kg),
            estoque_minimo, estoque (saldo inicial). Código que já existe é atualizado sem mexer no saldo.
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-gray-200 p-3 text-xs">{"codigo;nome;categoria;unidade;preco;estoque_minimo;estoque\nCAB-25;Cabo 2,5mm;Cabos;m;8,90;50;300\nDJ-20;Disjuntor 20A;Disjuntores;un;25,00;5;40"}</pre>
        </Cartao>

        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        {resultado ? <Aviso>{resultado}</Aviso> : null}

        {linhas.length ? (
          <Cartao
            titulo={`2. Confira (${validas.length} válidas, ${linhas.length - validas.length} com problema)`}
            acao={
              <div className="flex gap-2">
                <Botao variante="secundario" onClick={cancelar} disabled={enviando}>Cancelar</Botao>
                <Botao onClick={importar} carregando={enviando} disabled={!validas.length}>Importar {validas.length}</Botao>
              </div>
            }
          >
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase text-gray-600">
                  <tr>
                    <th className="py-2 pr-3">Linha</th>
                    <th className="py-2 pr-3">Situação</th>
                    <th className="py-2 pr-3">Produto</th>
                    <th className="py-2 pr-3 text-right">Preço</th>
                    <th className="py-2 text-right">Saldo inicial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300/60">
                  {linhas.map((l) => (
                    <tr key={l.linha} className={l.erro ? "bg-danger/5" : ""}>
                      <td className="py-2 pr-3">{l.linha}</td>
                      <td className="py-2 pr-3">
                        {l.erro ? <Selo tom="vermelho">{l.erro}</Selo> : codigosExistentes.has(l.dados!.codigo) ? <Selo tom="amarelo">Atualiza</Selo> : <Selo tom="verde">Novo</Selo>}
                      </td>
                      <td className="py-2 pr-3">{l.dados ? `${l.dados.codigo} · ${l.dados.nome}` : ""}</td>
                      <td className="py-2 pr-3 text-right">{l.dados ? formatMoeda(l.dados.precoVenda) : ""}</td>
                      <td className="py-2 text-right">
                        {l.dados?.estoqueInicial !== undefined ? (codigosExistentes.has(l.dados.codigo) ? "ignorado" : `${formatQuantidade(l.dados.estoqueInicial)} ${l.dados.unidade}`) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>
        ) : null}
      </div>
    </>
  );
}
