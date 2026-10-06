import { parseMoeda, parseQuantidade } from "./calc.ts";

const UNIDADES = ["un", "m", "rolo", "cx", "kg"] as const;

export interface ProdutoImportado {
  codigo: string;
  nome: string;
  categoria: string;
  marca: string;
  unidade: (typeof UNIDADES)[number];
  precoVenda: number;
  estoqueMinimo: number;
  estoqueInicial?: number;
  ativo: boolean;
}

export interface LinhaImportacao {
  linha: number; // número da linha na planilha (cabeçalho = 1)
  dados?: ProdutoImportado;
  erro?: string;
}

// nome da coluna (sem acento, minúsculo, sem espaço) -> campo
const ALIAS: Record<string, string> = {
  codigo: "codigo", sku: "codigo", cod: "codigo",
  nome: "nome", produto: "nome", descricao: "nome",
  categoria: "categoria",
  marca: "marca",
  unidade: "unidade", un: "unidade", und: "unidade",
  preco: "preco", precovenda: "preco", valor: "preco", precodevenda: "preco",
  estoqueminimo: "minimo", minimo: "minimo",
  estoque: "estoque", saldo: "estoque", estoqueinicial: "estoque", quantidade: "estoque",
};

const chave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * Linhas do Excel (matriz: 1ª linha = cabeçalho) no mesmo formato que o CSV devolve.
 * Célula numérica vira texto com vírgula ("8,9"), que é o que parseMoeda/parseQuantidade esperam.
 */
export function linhasDeMatriz(matriz: unknown[][]): Record<string, string>[] {
  const texto = (c: unknown) =>
    typeof c === "string" ? c : typeof c === "number" && Number.isFinite(c) ? String(Number(c.toFixed(6))).replace(".", ",") : "";
  const [cab = [], ...resto] = matriz;
  const nomes = cab.map((c, i) => texto(c).trim() || `coluna${i + 1}`);
  return resto
    .filter((r) => r.some((c) => texto(c).trim()))
    .map((r) => Object.fromEntries(nomes.map((n, i) => [n, texto(r[i])])));
}

/** Converte as linhas do CSV (objetos por cabeçalho) em produtos validados ou erros por linha. */
export function lerPlanilha(rows: Record<string, string>[]): { linhas: LinhaImportacao[]; faltando: string[] } {
  const colunas = new Map<string, string>(); // campo -> cabeçalho original
  for (const h of Object.keys(rows[0] ?? {})) {
    const campo = ALIAS[chave(h)];
    if (campo && !colunas.has(campo)) colunas.set(campo, h);
  }
  const faltando = ["codigo", "nome", "preco"].filter((c) => !colunas.has(c));
  if (faltando.length) return { linhas: [], faltando };

  const visto = new Set<string>();
  const linhas = rows.map((r, i): LinhaImportacao => {
    const linha = i + 2;
    const v = (campo: string) => (colunas.has(campo) ? (r[colunas.get(campo)!] ?? "").trim() : "");
    const codigo = v("codigo").toUpperCase();
    const nome = v("nome");
    if (!codigo && !nome && !v("preco")) return { linha, erro: "Linha vazia" };
    if (!codigo) return { linha, erro: "Falta o código" };
    if (!nome) return { linha, erro: "Falta o nome" };
    if (codigo.length > 40) return { linha, erro: "Código com mais de 40 caracteres" };
    if (nome.length > 120) return { linha, erro: "Nome com mais de 120 caracteres" };
    if (v("categoria").length > 60 || v("marca").length > 60) return { linha, erro: "Categoria ou marca com mais de 60 caracteres" };
    if (visto.has(codigo)) return { linha, erro: `Código ${codigo} repetido na planilha` };
    visto.add(codigo);

    const unidade = (v("unidade").toLowerCase() || "un") as ProdutoImportado["unidade"];
    if (!UNIDADES.includes(unidade)) return { linha, erro: `Unidade "${v("unidade")}" inválida (use ${UNIDADES.join(", ")})` };
    const preco = parseMoeda(v("preco"));
    if (Number.isNaN(preco) || preco < 1 || preco > 100_000_000) return { linha, erro: `Preço "${v("preco")}" inválido (de 0,01 a 1.000.000,00)` };
    const minimo = v("minimo") ? parseQuantidade(v("minimo")) : 0;
    if (Number.isNaN(minimo)) return { linha, erro: `Estoque mínimo "${v("minimo")}" inválido (use vírgula: 1500 ou 1,5)` };
    const estoque = v("estoque") ? parseQuantidade(v("estoque")) : undefined;
    if (estoque !== undefined && Number.isNaN(estoque)) return { linha, erro: `Estoque "${v("estoque")}" inválido (use vírgula: 1500 ou 1,5)` };

    return {
      linha,
      dados: {
        codigo, nome, categoria: v("categoria"), marca: v("marca"), unidade,
        precoVenda: preco, estoqueMinimo: minimo, estoqueInicial: estoque, ativo: true,
      },
    };
  });
  return { linhas, faltando: [] };
}
