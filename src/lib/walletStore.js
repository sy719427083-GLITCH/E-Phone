export const WALLET_STORAGE_KEY = "ephone.wallet";

function makeBillId(prefix = "bill") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialWallet() {
  return {
    balance: 2000,
    bills: [],
  };
}

function mergeBill(bill = {}) {
  const createdAt = Number(bill.createdAt) || Date.now();
  return {
    id: bill.id || makeBillId(),
    messageId: bill.messageId || "",
    title: bill.title || "账单",
    note: bill.note || "",
    amount: Number(bill.amount) || 0,
    type: bill.amount > 0 ? "income" : "expense",
    createdAt,
    time: bill.time || new Date(createdAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

export class WalletStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.wallet = createInitialWallet();
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(WALLET_STORAGE_KEY) || "{}");
      this.wallet = {
        balance: Number.isFinite(Number(parsed.balance)) ? Number(parsed.balance) : 2000,
        bills: Array.isArray(parsed.bills) ? parsed.bills.map(mergeBill) : [],
      };
    } catch {
      this.wallet = createInitialWallet();
    }
  }

  persist() {
    this.storage?.setItem(WALLET_STORAGE_KEY, JSON.stringify(this.wallet));
  }

  snapshot() {
    return {
      balance: Number(this.wallet.balance.toFixed(2)),
      bills: [...this.wallet.bills].sort((a, b) => b.createdAt - a.createdAt),
    };
  }

  hasBill(messageId) {
    return Boolean(messageId && this.wallet.bills.some((bill) => bill.messageId === messageId));
  }

  addBill({ title, note, amount, messageId }) {
    if (messageId && this.hasBill(messageId)) return null;
    const bill = mergeBill({
      id: messageId ? `bill-${messageId}` : makeBillId(),
      title,
      note,
      amount,
      messageId,
      createdAt: Date.now(),
    });
    this.wallet.bills = [bill, ...this.wallet.bills];
    return bill;
  }

  clearBills() {
    this.wallet.bills = [];
    this.persist();
    return this.snapshot();
  }

  adjustBalance({ amount = 0, note = "手动调整", messageId = "" } = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) throw new Error("金额无效。");
    if (value < 0 && Math.abs(value) > this.wallet.balance) throw new Error("余额不足。");
    if (this.hasBill(messageId)) return this.snapshot();
    this.wallet.balance = Number((this.wallet.balance + value).toFixed(2));
    this.addBill({
      title: value > 0 ? "手动增加余额" : "手动减少余额",
      note,
      amount: value,
      messageId,
    });
    this.persist();
    return this.snapshot();
  }

  receiveRedPacket({ from = "对方", amount = 0, messageId = "" } = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error("红包金额无效。");
    if (this.hasBill(messageId)) return this.snapshot();
    this.wallet.balance = Number((this.wallet.balance + value).toFixed(2));
    this.addBill({
      title: "收到红包",
      note: from,
      amount: value,
      messageId,
    });
    this.persist();
    return this.snapshot();
  }

  receiveTransfer({ from = "对方", amount = 0, messageId = "" } = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error("转账金额无效。");
    if (this.hasBill(messageId)) return this.snapshot();
    this.wallet.balance = Number((this.wallet.balance + value).toFixed(2));
    this.addBill({
      title: "收到转账",
      note: from,
      amount: value,
      messageId,
    });
    this.persist();
    return this.snapshot();
  }

  receiveWorkPay({ job = "打工", amount = 0, messageId = "" } = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error("工资金额无效。");
    if (this.hasBill(messageId)) return this.snapshot();
    this.wallet.balance = Number((this.wallet.balance + value).toFixed(2));
    this.addBill({
      title: "打工收入",
      note: job,
      amount: value,
      messageId,
    });
    this.persist();
    return this.snapshot();
  }

  payWorkRefresh({ amount = 0, messageId = "" } = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error("刷新费用无效。");
    if (value > this.wallet.balance) throw new Error("余额不足。");
    if (this.hasBill(messageId)) return this.snapshot();
    this.wallet.balance = Number((this.wallet.balance - value).toFixed(2));
    this.addBill({
      title: "工作刷新",
      note: "刷新打工机会",
      amount: -value,
      messageId,
    });
    this.persist();
    return this.snapshot();
  }

  returnRedPacket() {
    return this.snapshot();
  }

  refundSentRedPacket({ from = "对方", amount = 0, messageId = "" } = {}) {
    const value = Number(amount);
    const refundMessageId = messageId ? `refund-${messageId}` : "";
    if (!Number.isFinite(value) || value <= 0) throw new Error("红包金额无效。");
    if (this.hasBill(refundMessageId)) return this.snapshot();
    this.wallet.balance = Number((this.wallet.balance + value).toFixed(2));
    this.addBill({
      title: "红包退回",
      note: from,
      amount: value,
      messageId: refundMessageId,
    });
    this.persist();
    return this.snapshot();
  }

  sendRedPacket({ to = "对方", amount = 0, messageId = "" } = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error("红包金额无效。");
    if (value > this.wallet.balance) throw new Error("余额不足。");
    if (this.hasBill(messageId)) return this.snapshot();
    this.wallet.balance = Number((this.wallet.balance - value).toFixed(2));
    this.addBill({
      title: "发出红包",
      note: to,
      amount: -value,
      messageId,
    });
    this.persist();
    return this.snapshot();
  }
}
