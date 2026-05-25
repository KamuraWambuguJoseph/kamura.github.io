// Wallet Application - JavaScript

class Wallet {
    constructor() {
        this.transactions = this.loadFromStorage() || [];
        this.currentFilter = 'all';
        this.editingId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.resetForm();
        this.render();
    }

    setupEventListeners() {
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });
    }

    importMpesaCsv(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result;
            const rows = this.parseCsv(text);
            const imported = this.buildTransactionsFromMpesa(rows);

            if (imported.length === 0) {
                alert('No valid Mpesa transactions were detected in this file.');
                return;
            }

            this.transactions = imported.concat(this.transactions);
            this.saveToStorage();
            this.render();
            alert(`${imported.length} Mpesa transactions imported successfully.`);
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    buildTransactionsFromMpesa(rows) {
        if (!rows || rows.length === 0) {
            return [];
        }

        const headers = Object.keys(rows[0]);
        const dateKey = this.findKey(headers, ['date', 'transaction date', 'payment date', 'trans date']);
        const timeKey = this.findKey(headers, ['time', 'transaction time', 'trans time']);
        const amountKey = this.findKey(headers, ['amount', 'transaction amount', 'amount (ksh)', 'amt']);
        const creditKey = this.findKey(headers, ['credit', 'credit amount', 'amount received']);
        const debitKey = this.findKey(headers, ['debit', 'debit amount', 'amount sent']);
        const descKey = this.findKey(headers, ['description', 'narration', 'details', 'transaction description', 'particulars']);
        const typeKey = this.findKey(headers, ['transaction type', 'type', 'tran type']);

        return rows.reduce((transactions, row) => {
            const rawDescription = (descKey && row[descKey]) ? row[descKey] : '';
            const rawType = (typeKey && row[typeKey]) ? row[typeKey] : '';
            const rawDate = (dateKey && row[dateKey]) ? row[dateKey] : '';
            const rawTime = (timeKey && row[timeKey]) ? row[timeKey] : '';

            let amount = NaN;
            let transactionType = 'Expense';

            const creditValue = creditKey ? this.parseNumber(row[creditKey]) : NaN;
            const debitValue = debitKey ? this.parseNumber(row[debitKey]) : NaN;
            const amountValue = amountKey ? this.parseNumber(row[amountKey]) : NaN;

            if (!isNaN(creditValue) && creditValue !== 0) {
                amount = creditValue;
                transactionType = 'Income';
            } else if (!isNaN(debitValue) && debitValue !== 0) {
                amount = debitValue;
                transactionType = 'Expense';
            } else if (!isNaN(amountValue)) {
                amount = Math.abs(amountValue);
                transactionType = amountValue >= 0 ? 'Income' : 'Expense';
            }

            if (isNaN(amount) || amount === 0) {
                return transactions;
            }

            const parsedDate = this.parseDateValue(rawDate, rawTime);
            let category = rawType || 'Mpesa';
            if (!category || category.trim() === '') {
                category = this.detectCategory(rawDescription);
            }

            const transaction = {
                id: Date.now() + Math.random(),
                amount,
                category,
                description: rawDescription || 'Mpesa transaction',
                date: parsedDate.toISOString(),
                type: transactionType
            };

            transactions.push(transaction);
            return transactions;
        }, []);
    }

    parseCsv(text) {
        const rows = text.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim().length > 0);
        const result = [];
        if (rows.length === 0) {
            return result;
        }

        const headers = this.splitCsvLine(rows[0]).map(h => h.trim().toLowerCase());
        for (let i = 1; i < rows.length; i += 1) {
            const values = this.splitCsvLine(rows[i]);
            if (values.every(v => v.trim() === '')) {
                continue;
            }
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] ? values[index].trim() : '';
            });
            result.push(row);
        }

        return result;
    }

    splitCsvLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current);
        return values;
    }

    findKey(keys, candidates) {
        const normalized = keys.map(k => k.toLowerCase());
        return candidates.find(candidate => normalized.includes(candidate.toLowerCase())) || null;
    }

    parseNumber(value) {
        if (!value) {
            return NaN;
        }
        const cleaned = String(value).replace(/[^0-9.\-]/g, '');
        return parseFloat(cleaned);
    }

    parseDateValue(dateString, timeString) {
        if (!dateString) {
            return new Date();
        }

        const dateTime = timeString ? `${dateString} ${timeString}` : dateString;
        const parsed = new Date(dateTime);
        return Number.isNaN(parsed.getTime()) ? new Date(dateString) : parsed;
    }

    detectCategory(description) {
        const text = description.toLowerCase();
        if (/airtime|data|bundle|topup/.test(text)) {
            return 'Bills';
        }
        if (/salary|payroll|received|deposit|refund/.test(text)) {
            return 'Income';
        }
        if (/rent|house|mortgage/.test(text)) {
            return 'Bills';
        }
        if (/food|restaurant|hotel|dining|coffee/.test(text)) {
            return 'Food';
        }
        if (/transport|taxi|uber|bolt|bus|train|fuel/.test(text)) {
            return 'Transport';
        }
        if (/shopping|store|market|mall/.test(text)) {
            return 'Shopping';
        }
        if (/loan|insurance|medical|clinic|hospital/.test(text)) {
            return 'Health';
        }
        return 'Other';
    }

    addTransaction() {
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value.trim();
        const dateValue = document.getElementById('date').value;

        if (!amount || amount <= 0 || !category || !description || !dateValue) {
            alert('Please fill in all fields and enter an amount greater than 0.');
            return;
        }

        const chosenDate = new Date(`${dateValue}T00:00:00`);

        const transaction = {
            id: this.editingId || Date.now(),
            amount: amount,
            category: category,
            description: description,
            date: chosenDate.toISOString(),
            type: category === 'Income' ? 'Income' : 'Expense'
        };

        if (this.editingId !== null) {
            this.updateTransaction(transaction);
        } else {
            this.transactions.unshift(transaction);
            this.saveToStorage();
            this.resetForm();
            this.render();
        }
    }

    updateTransaction(transaction) {
        this.transactions = this.transactions.map(t => t.id === transaction.id ? transaction : t);
        this.saveToStorage();
        this.editingId = null;
        this.resetForm();
        this.render();
    }

    startEdit(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (!transaction) {
            return;
        }

        this.editingId = id;
        document.getElementById('amount').value = transaction.amount;
        document.getElementById('category').value = transaction.category;
        document.getElementById('description').value = transaction.description;
        document.getElementById('date').value = new Date(transaction.date).toISOString().split('T')[0];
        document.getElementById('submitButton').textContent = 'Update Transaction';
        document.getElementById('cancelEditBtn').classList.remove('hidden');
        document.getElementById('amount').focus();
    }

    cancelEdit() {
        this.editingId = null;
        this.resetForm();
    }

    deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            if (this.editingId === id) {
                this.cancelEdit();
            }
            this.saveToStorage();
            this.render();
        }
    }

    resetForm() {
        document.getElementById('transactionForm').reset();
        document.getElementById('submitButton').textContent = 'Add Transaction';
        document.getElementById('cancelEditBtn').classList.add('hidden');

        const today = new Date();
        document.getElementById('date').value = today.toISOString().split('T')[0];
        document.getElementById('amount').focus();
    }

    getBalance() {
        return this.transactions.reduce((balance, t) => {
            return t.type === 'Income' ? balance + t.amount : balance - t.amount;
        }, 0);
    }

    getTotalIncome() {
        return this.transactions
            .filter(t => t.type === 'Income')
            .reduce((sum, t) => sum + t.amount, 0);
    }

    getTotalExpense() {
        return this.transactions
            .filter(t => t.type === 'Expense')
            .reduce((sum, t) => sum + t.amount, 0);
    }

    getFilteredTransactions() {
        if (this.currentFilter === 'all') {
            return this.transactions;
        }
        return this.transactions.filter(t => t.type === this.currentFilter);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatDate(date) {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (d.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }

    render() {
        this.updateBalance();
        this.renderTransactions();
    }

    updateBalance() {
        document.getElementById('balanceAmount').textContent = this.formatCurrency(this.getBalance());
        document.getElementById('totalIncome').textContent = this.formatCurrency(this.getTotalIncome());
        document.getElementById('totalExpense').textContent = this.formatCurrency(this.getTotalExpense());
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        const transactions = this.getFilteredTransactions();

        if (transactions.length === 0) {
            container.innerHTML = '<p class="empty-message">No transactions found.</p>';
            return;
        }

        container.innerHTML = transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-category">${transaction.category}</div>
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-date">${this.formatDate(transaction.date)}</div>
                </div>
                <div class="transaction-amount ${transaction.type.toLowerCase()}">
                    ${transaction.type === 'Income' ? '+' : '-'}${this.formatCurrency(transaction.amount)}
                </div>
                <div class="transaction-actions">
                    <button class="btn btn-cancel" onclick="wallet.startEdit(${transaction.id})">Edit</button>
                    <button class="delete-btn" onclick="wallet.deleteTransaction(${transaction.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    saveToStorage() {
        localStorage.setItem('walletTransactions', JSON.stringify(this.transactions));
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('walletTransactions');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error loading data from storage:', e);
            return null;
        }
    }
}

// Global wallet instance
let wallet;

// Initialize wallet when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    wallet = new Wallet();
});

// Filter function
function filterTransactions(type, event) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }

    wallet.currentFilter = type;
    wallet.render();
}

// Clear all data function
function clearAllData() {
    if (confirm('This will delete ALL transactions. Are you sure?')) {
        wallet.transactions = [];
        wallet.cancelEdit();
        wallet.saveToStorage();
        wallet.render();
    }
}
