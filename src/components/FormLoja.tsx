"use client";
import { doc, updateDoc } from "firebase/firestore";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { db } from "@/lib/firebase";
import Aviso from "./ui/Aviso";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import { inputCls } from "./ui/estilos";

export default function FormLoja() {
  const loja = useAuth().loja!;
  const toast = useToast();
  const [f, setF] = useState({
    nome: loja.nome,
    cnpj: loja.cnpj ?? "",
    telefone: loja.telefone ?? "",
    endereco: loja.endereco ?? "",
    logoUrl: loja.logoUrl ?? "",
    logoMenuUrl: loja.logoMenuUrl ?? "",
    marcaDaguaUrl: loja.marcaDaguaUrl ?? "",
    textoRodapePdf: loja.textoRodapePdf ?? "",
    validade: String(loja.validadePadraoDias),
    descMax: String(loja.descontoMaxVendedorPct),
    semEstoque: loja.permiteVendaSemEstoque,
  });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  // Reduz para no máximo 500 px e guarda dentro da loja (PNG; JPG se ficar pesado).
  // Só a logo do menu tem a margem vazia (transparente ou branca) cortada; o PDF usa a imagem como veio.
  async function escolherImagem(campo: "logoUrl" | "logoMenuUrl" | "marcaDaguaUrl", file?: File) {
    if (!file) return;
    try {
      const img = await createImageBitmap(file);
      const k0 = Math.min(1, 1000 / Math.max(img.width, img.height));
      const grande = document.createElement("canvas");
      grande.width = Math.round(img.width * k0);
      grande.height = Math.round(img.height * k0);
      const g0 = grande.getContext("2d", { willReadFrequently: true })!;
      g0.drawImage(img, 0, 0, grande.width, grande.height);
      const { x, y, w, h } =
        campo === "logoMenuUrl" ? limitesDoDesenho(g0.getImageData(0, 0, grande.width, grande.height)) : { x: 0, y: 0, w: grande.width, h: grande.height };

      const k = Math.min(1, 500 / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * k));
      c.height = Math.max(1, Math.round(h * k));
      const g = c.getContext("2d")!;
      g.drawImage(grande, x, y, w, h, 0, 0, c.width, c.height);
      let url = c.toDataURL("image/png");
      if (url.length > 240000) {
        g.globalCompositeOperation = "destination-over";
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        url = c.toDataURL("image/jpeg", 0.85);
      }
      if (url.length > 240000) return setErro("Imagem muito pesada. Tente uma foto menor.");
      setErro("");
      set(campo, url);
    } catch {
      setErro("Não consegui ler essa imagem. Use PNG ou JPG.");
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const validade = Number(f.validade);
    const descMax = Number(f.descMax.replace(",", "."));
    if (!f.nome.trim()) return setErro("Informe o nome da loja.");
    if (!Number.isInteger(validade) || validade < 1 || validade > 365) return setErro("Validade padrão: de 1 a 365 dias.");
    if (!Number.isFinite(descMax) || descMax < 0 || descMax > 100) return setErro("Limite de desconto: de 0 a 100%.");
    setErro("");
    setEnviando(true);
    try {
      await updateDoc(doc(db, "lojas", loja.id), {
        nome: f.nome.trim(),
        cnpj: f.cnpj.trim(),
        telefone: f.telefone.trim(),
        endereco: f.endereco.trim(),
        logoUrl: f.logoUrl.trim(),
        logoMenuUrl: f.logoMenuUrl,
        marcaDaguaUrl: f.marcaDaguaUrl,
        textoRodapePdf: f.textoRodapePdf.trim(),
        validadePadraoDias: validade,
        descontoMaxVendedorPct: descMax,
        permiteVendaSemEstoque: f.semEstoque,
      });
      toast("Configurações salvas.");
    } catch {
      setErro("Não foi possível salvar. Verifique a conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome da loja"><input value={f.nome} onChange={(e) => set("nome", e.target.value)} maxLength={120} className={inputCls} /></Campo>
        <Campo rotulo="CNPJ"><input value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} maxLength={20} className={inputCls} /></Campo>
        <Campo rotulo="Telefone"><input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} maxLength={30} className={inputCls} /></Campo>
        <Campo rotulo="Endereço"><input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} maxLength={200} className={inputCls} /></Campo>
        <Campo rotulo="Logo do menu do app" dica="Aparece no topo do menu e no celular. A margem vazia é cortada para a logo ficar maior." className="sm:col-span-2">
          <EscolherImagem valor={f.logoMenuUrl} nome="Logo do menu" onEscolher={(file) => escolherImagem("logoMenuUrl", file)} onRemover={() => set("logoMenuUrl", "")} />
        </Campo>
        <Campo rotulo="Logo do PDF" dica="Logo completa. Aparece no topo do PDF do orçamento; é reduzida automaticamente." className="sm:col-span-2">
          <EscolherImagem valor={f.logoUrl} nome="Logo" onEscolher={(file) => escolherImagem("logoUrl", file)} onRemover={() => set("logoUrl", "")} />
        </Campo>
        <Campo rotulo="Marca d'água (escudo)" dica="Símbolo da loja, bem clarinho no fundo de cada página do PDF. PNG com fundo transparente fica melhor." className="sm:col-span-2">
          <EscolherImagem valor={f.marcaDaguaUrl} nome="Marca d'água" onEscolher={(file) => escolherImagem("marcaDaguaUrl", file)} onRemover={() => set("marcaDaguaUrl", "")} />
        </Campo>
        <Campo rotulo="Texto do rodapé do PDF" className="sm:col-span-2"><input value={f.textoRodapePdf} onChange={(e) => set("textoRodapePdf", e.target.value)} maxLength={200} className={inputCls} placeholder="Ex.: Preços sujeitos a alteração sem aviso." /></Campo>
        <Campo rotulo="Validade padrão do orçamento (dias)"><input inputMode="numeric" value={f.validade} onChange={(e) => set("validade", e.target.value)} className={inputCls} /></Campo>
        <Campo rotulo="Desconto máximo do vendedor (%)" dica="Acima disso só o dono salva o orçamento."><input inputMode="decimal" value={f.descMax} onChange={(e) => set("descMax", e.target.value)} className={inputCls} /></Campo>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={f.semEstoque} onChange={(e) => set("semEstoque", e.target.checked)} />
        <span>Permitir vender sem estoque suficiente <span className="block text-xs text-gray-600">O saldo fica negativo e aparece em destaque. Desmarcado, a venda é bloqueada.</span></span>
      </label>
      <div className="flex justify-end"><Botao type="submit" carregando={enviando}>Salvar</Botao></div>
    </form>
  );
}

function EscolherImagem({ valor, nome, onEscolher, onRemover }: { valor: string; nome: string; onEscolher: (f?: File) => void; onRemover: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {valor ? (
        // eslint-disable-next-line @next/next/no-img-element -- pré-visualização de data URL
        <img src={valor} alt={`${nome} atual`} className="h-16 max-w-40 rounded border border-gray-200 object-contain" />
      ) : null}
      <input type="file" accept="image/png,image/jpeg" onChange={(e) => onEscolher(e.target.files?.[0])} className="text-sm" />
      {valor ? <button type="button" onClick={onRemover} className="text-sm text-red-600 underline">Remover</button> : null}
    </div>
  );
}

/** Retângulo que contém o desenho, com 2% de folga. Sem transparência usa "não é quase branco"; se não achar nada, a imagem toda. */
function limitesDoDesenho(d: ImageData) {
  const { data, width, height } = d;
  let temAlpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { temAlpha = true; break; }
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const tem = temAlpha ? data[i + 3] > 16 : data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245;
      if (!tem) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: width, h: height };
  const folga = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  x0 = Math.max(0, x0 - folga);
  y0 = Math.max(0, y0 - folga);
  x1 = Math.min(width - 1, x1 + folga);
  y1 = Math.min(height - 1, y1 + folga);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
