// Modelo de dados (Firestore). Valores em CENTAVOS (R$ 8,90 = 890) e
// quantidades em MILÉSIMOS (12,5 m = 12500). Sempre inteiros, nunca float.
import type { Timestamp } from "firebase/firestore";

export type Perfil = "dono" | "vendedor";
export type Unidade = "un" | "m" | "rolo" | "cx" | "kg";
export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado" | "expirado";
export type StatusVenda = "concluida" | "cancelada";
export type TipoMovimentacao = "entrada" | "venda" | "ajuste" | "perda" | "estorno";

// lojas/{lojaId}
export interface Loja {
  nome: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  logoUrl?: string;
  logoMenuUrl?: string; // logo do menu do app (recortada); o PDF usa logoUrl
  marcaDaguaUrl?: string; // escudo/símbolo em transparência no fundo do PDF (data URL png/jpeg)
  validadePadraoDias: number;
  textoRodapePdf?: string;
  descontoMaxVendedorPct: number; // acima disso exige dono (regra 10)
  permiteVendaSemEstoque: boolean; // regra 8, a confirmar com o dono
  // contadores de numeração sequencial (só o servidor mexe)
  ultimoNumeroOrcamento: number;
  ultimoNumeroVenda: number;
}

// usuarios/{uid}  (uid = Firebase Auth uid)
export interface Usuario {
  lojaId: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}

// clientes/{id}
export interface Cliente {
  lojaId: string;
  nome: string;
  telefone?: string;
  cpfCnpj?: string;
  endereco?: string;
  observacoes?: string;
  criadoEm: Timestamp;
}

// produtos/{id}
export interface Produto {
  lojaId: string;
  codigo: string;
  nome: string;
  categoria?: string;
  marca?: string;
  unidade: Unidade;
  precoVenda: number; // centavos
  estoqueAtual: number; // milésimos — só o servidor escreve
  estoqueMinimo: number; // milésimos
  // Firestore não compara dois campos numa query; o servidor mantém este
  // flag (estoqueAtual <= estoqueMinimo) para a lista de "estoque baixo".
  abaixoDoMinimo: boolean;
  ativo: boolean;
}

// orcamentos/{id}  — escrita só pelo servidor (numeração, limite de desconto)
export interface Orcamento {
  lojaId: string;
  numero: string; // ORC-0001
  clienteId: string;
  usuarioId: string;
  status: StatusOrcamento;
  subtotal: number;
  desconto: number;
  total: number;
  validade: Timestamp;
  formaPagamento?: string;
  observacoes?: string;
  vendaId?: string; // preenchido ao converter; some se a venda for cancelada
  linkRevogadoEm?: number; // ms; links de PDF emitidos antes disso deixam de valer
  criadoEm: Timestamp;
}

// Item de orçamento/venda. Copia nome, unidade e preço no momento (regra 5).
// Fica em orcamentos/{id}/itens/{itemId} e vendas/{id}/itens/{itemId}.
export interface ItemDocumento {
  ordem: number; // posição na tela e no PDF (a leitura ordena por aqui)
  produtoId: string;
  descricao: string;
  unidade: Unidade;
  quantidade: number; // milésimos
  precoUnitario: number; // centavos
  desconto: number; // centavos
  total: number; // centavos
}

// vendas/{id}  — escrita só pelo servidor, em transação com a baixa de estoque
export interface Venda {
  lojaId: string;
  numero: string; // VEN-0001
  orcamentoId?: string;
  clienteId?: string;
  usuarioId: string;
  total: number;
  formaPagamento?: string;
  status: StatusVenda;
  criadoEm: Timestamp;
}

// movimentacoes/{id}  — imutável (nunca update/delete)
export interface Movimentacao {
  lojaId: string;
  produtoId: string;
  tipo: TipoMovimentacao;
  quantidade: number; // milésimos; negativo = saída
  saldoApos: number; // milésimos
  motivo: string; // obrigatório em ajuste e perda
  vendaId?: string;
  usuarioId: string;
  usuarioNome?: string; // gravado junto para o histórico mostrar "quem" sem ler usuarios
  criadoEm: Timestamp;
}
