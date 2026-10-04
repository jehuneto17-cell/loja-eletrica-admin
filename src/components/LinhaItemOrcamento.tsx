import { formatMoeda, formatQuantidade, parseQuantidade } from "@/lib/calc";
import type { ItemForm, LinhaCalc } from "@/lib/orcamentoForm";
import type { Produto } from "@/types";
import { inputCls } from "./ui/estilos";

interface Props {
  item: ItemForm;
  calc: LinhaCalc;
  produto?: Produto; // para o aviso de estoque
  onChange: (patch: Partial<ItemForm>) => void;
  onRemover: () => void;
}

const rotulo = "mb-1 block text-xs text-gray-600 sm:hidden";
const rotuloInline = "text-xs text-gray-600 sm:hidden";

/** Linha de item: no celular empilha com rótulos; no desktop vira uma linha de tabela. */
export default function LinhaItemOrcamento({ item, calc, produto, onChange, onRemover }: Props) {
  const q = parseQuantidade(item.qtd);
  const falta = produto && !Number.isNaN(q) && q > produto.estoqueAtual;
  return (
    <div className="grid gap-2 border-b border-gray-300/60 py-3 sm:grid-cols-[1fr_96px_96px_96px_96px_32px] sm:items-start">
      <div>
        <p className="font-medium text-gray-900">{item.descricao}</p>
        {falta ? (
          <p className="text-xs font-medium text-yellow-800">
            Estoque insuficiente: saldo {formatQuantidade(produto.estoqueAtual)} {produto.unidade}
          </p>
        ) : null}
        {calc.erro ? <p className="text-xs text-danger">{calc.erro}</p> : null}
      </div>
      <label>
        <span className={rotulo}>Qtd. ({item.unidade})</span>
        <input inputMode="decimal" aria-label={`Quantidade de ${item.descricao}`} value={item.qtd} onChange={(e) => onChange({ qtd: e.target.value })} className={inputCls} />
      </label>
      <div className="flex items-center justify-between sm:block sm:pt-2 sm:text-right">
        <span className={rotuloInline}>Preço</span>
        {formatMoeda(item.preco)}
      </div>
      <label>
        <span className={rotulo}>Desconto (R$)</span>
        <input inputMode="decimal" aria-label={`Desconto de ${item.descricao}`} value={item.desc} onChange={(e) => onChange({ desc: e.target.value })} placeholder="0,00" className={inputCls} />
      </label>
      <div className="flex items-center justify-between font-semibold sm:block sm:pt-2 sm:text-right">
        <span className={rotuloInline}>Total</span>
        {calc.erro ? "—" : formatMoeda(calc.total)}
      </div>
      <button type="button" onClick={onRemover} aria-label={`Remover ${item.descricao}`} className="self-start rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-danger sm:mt-1">
        ✕
      </button>
    </div>
  );
}
