import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://cjivfdlrrwuwegybtpty.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mcec1_u6zMIRD2kFMWOulA_d_8thPqr';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('en-EG', {
  style: 'currency', currency: 'EGP', maximumFractionDigits: 2
}).format(Number(value || 0));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function dateText(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function initAuthPage() {
const form = $('#authForm');
if (!form) return;

const submit = $('#authSubmit');
const switchButton = $('#switchAuth');
const heading = $('#authHeading');
const helper = $('#authHelper');
const password = $('#password');
const message = $('#authMessage');

let mode = 'login';
let messageTimer;

function showMessage(text, type = 'info') {
clearTimeout(messageTimer);

message.textContent = text;
message.className = `auth-message ${type}`;
message.hidden = false;

messageTimer = setTimeout(() => {
  message.hidden = true;
}, 3000);
}

function hideMessage() {
clearTimeout(messageTimer);
message.hidden = true;
}

function updateMode() {
heading.textContent = mode === 'login'
? 'log in'
: 'create account';

submit.textContent = mode === 'login'
  ? 'Log in'
  : 'Sign up';

switchButton.textContent = mode === 'login'
  ? 'Create an account'
  : 'I already have an account';

helper.textContent = mode === 'login'
  ? 'New to ARGUS? Create your account.'
  : 'Already registered? Log in instead.';

password.autocomplete = mode === 'login'
  ? 'current-password'
  : 'new-password';
}

const { data: { session } } = await supabase.auth.getSession();

if (session) {
window.location.replace('dashboard.html');
return;
}

switchButton.addEventListener('click', () => {
mode = mode === 'login' ? 'signup' : 'login';
hideMessage();
updateMode();
});

form.addEventListener('submit', async (event) => {
event.preventDefault();

const email = $('#email').value.trim();
const passwordValue = password.value;

if (!email || !passwordValue) {
  showMessage('Please fill in all fields.', 'info');
  return;
}

submit.disabled = true;
submit.textContent = 'Please wait...';
hideMessage();

try {
  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: passwordValue
    });

    if (error) throw error;

    // Sign out after signup so the user can log in manually.
    if (data.session) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    }

    mode = 'login';
    password.value = '';
    updateMode();

    showMessage(
      'Account created successfully! Please log in.',
      'success'
    );

  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: passwordValue
    });

    if (error) throw error;

    showMessage('Welcome back! Redirecting...', 'success');

    window.location.href = 'dashboard.html';
  }

} catch (error) {
  console.error('Authentication error:', error);

  const errorMessage = error.message?.toLowerCase() || '';

  if (
    errorMessage.includes('invalid login credentials') ||
    errorMessage.includes('invalid credentials')
  ) {
    showMessage('Invalid email or password.', 'error');

  } else if (
    errorMessage.includes('already registered') ||
    errorMessage.includes('already been registered') ||
    errorMessage.includes('user already registered')
  ) {
    showMessage('This email is already registered.', 'error');

  } else if (errorMessage.includes('password')) {
    showMessage('Password must meet the required security rules.', 'error');

  } else if (errorMessage.includes('email')) {
    showMessage('Please enter a valid email address.', 'error');

  } else {
    showMessage('Something went wrong. Please try again.', 'error');
  }

} finally {
  submit.disabled = false;
  submit.textContent = mode === 'login' ? 'Log in' : 'Sign up';
}
});
}

async function initDashboard() {
  if (!$('#dashboardApp')) return;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) {
    window.location.replace('index.html');
    return;
  }

  const user = session.user;

  let wallet = null;
  let incomes = [];
  let expenses = [];

  $('#logoutBtn').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(error);
      return;
    }
    window.location.replace('index.html');
  });

  async function loadWallet() {
    const { data, error } = await supabase.from('wallets')
      .select('user_id, initial_balance')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    wallet = data;
  }

  async function loadIncomes() {
    const { data, error } = await supabase.from('incomes')
      .select('id, title, amount, category, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    incomes = data || [];
  }

  async function loadExpenses() {
    const { data, error } = await supabase.from('expenses')
      .select('id, title, amount, category, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    expenses = data || [];
  }

  const totals = () => {
    const starting = Number(wallet?.initial_balance || 0);
    const added = incomes.reduce((sum, item) => sum + Number(item.amount), 0);
    const spent = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    return { starting, added, spent, balance: starting + added - spent };
  };

  function renderSummary() {
    const t = totals();
    $('#balanceValue').textContent = money(t.balance);
    $('#startingValue').textContent = money(t.starting);
    $('#incomeValue').textContent = money(t.added);
    $('#expensesValue').textContent = money(t.spent);
  }

  function renderCategoryBreakdown() {
    const categoryTotals = {};
    expenses.forEach((item) => {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + Number(item.amount);
    });
    const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const target = $('#categoryBreakdown');
    if (!entries.length) {
      target.innerHTML = '<p class="empty-state">Your spending categories will appear here.</p>';
      return;
    }
    target.innerHTML = entries.map(([category, amount]) => `
      <div class="category-item">
        <div class="category-line"><span>${escapeHtml(category)}</span><strong>${money(amount)}</strong></div>
      </div>
    `).join('');
  }

  function renderHistory(items, target, kind) {
    if (!items.length) {
      target.innerHTML = `<p class="empty-state">No ${kind === 'income' ? 'money added' : 'expenses'} recorded yet.</p>`;
      return;
    }
    const isIncome = kind === 'income';
    target.innerHTML = items.map((item) => `
      <article class="expense-row">
        <div class="expense-info">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.category)} · ${dateText(item.created_at)}</span>
        </div>
        <strong class="${isIncome ? 'income-amount' : 'expense-amount'}">
          ${isIncome ? '+' : '−'} ${money(item.amount)}
        </strong>
        <div class="expense-actions">
          <button type="button" class="small-button edit-record" data-kind="${kind}" data-id="${item.id}">Edit</button>
          <button type="button" class="small-button danger-button delete-record" data-kind="${kind}" data-id="${item.id}">Delete</button>
        </div>
      </article>
    `).join('');
  }

  async function loadAdminPanel() {
    const { data, error } = await supabase.rpc('admin_list_users');
    if (error) {
      $('#adminPanel').hidden = true;
      return;
    }
    $('#adminPanel').hidden = false;
    $('#adminUserCount').textContent = String(data?.length || 0);
    const list = $('#adminUsersList');
    if (!data?.length) {
      list.innerHTML = '<p class="empty-state">No registered accounts found.</p>';
      return;
    }
    list.innerHTML = data.map((account) => `
      <article class="admin-user">
        <div class="admin-user-main">
          <strong>${escapeHtml(account.email || 'No email')}</strong>
          <small>Joined: ${dateText(account.created_at)}</small>
        </div>
        <div class="admin-last-seen">
          Last sign-in<br>${dateText(account.last_sign_in_at)}
        </div>
      </article>
    `).join('');
  }

  async function refresh() {
    await Promise.all([loadWallet(), loadIncomes(), loadExpenses()]);
    renderSummary();
    renderCategoryBreakdown();
    renderHistory(incomes, $('#incomeList'), 'income');
    renderHistory(expenses, $('#expenseList'), 'expense');
    await loadAdminPanel();
  }

  $('#incomeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = $('#incomeTitle').value.trim();
    const amount = Number($('#incomeAmount').value);
    const category = $('#incomeCategory').value;
    if (!title || !Number.isFinite(amount) || amount <= 0) return;
    const button = $('#incomeForm button[type="submit"]');
    button.disabled = true;
    try {
      const { error } = await supabase.from('incomes').insert({
        user_id: user.id, title, amount, category
      });
      if (error) throw error;
      $('#incomeForm').reset();
      await refresh();
    } catch {
    } finally {
      button.disabled = false;
    }
  });

  $('#expenseForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = $('#expenseTitle').value.trim();
    const amount = Number($('#expenseAmount').value);
    const category = $('#expenseCategory').value;
    if (!title || !Number.isFinite(amount) || amount <= 0) return;
    if (amount > totals().balance) return;
    const button = $('#expenseForm button[type="submit"]');
    button.disabled = true;
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id, title, amount, category
      });
      if (error) throw error;
      $('#expenseForm').reset();
      await refresh();
    } catch {
    } finally {
      button.disabled = false;
    }
  });

  async function handleHistoryAction(event) {
    const deleteButton = event.target.closest('.delete-record');
    const editButton = event.target.closest('.edit-record');
    if (!deleteButton && !editButton) return;

    const button = deleteButton || editButton;
    const kind = button.dataset.kind;
    const id = button.dataset.id;
    const records = kind === 'income' ? incomes : expenses;
    const item = records.find((record) => record.id === id);
    if (!item) return;
    const table = kind === 'income' ? 'incomes' : 'expenses';

    if (deleteButton) {
      if (!window.confirm(`Delete "${item.title}"?`)) return;
      const { error } = await supabase.from(table).delete()
        .eq('id', id).eq('user_id', user.id);
      if (error) return;
      await refresh();
      return;
    }

    const newTitle = window.prompt('Description:', item.title);
    if (newTitle === null) return;
    const newAmountText = window.prompt('Amount (EGP):', String(item.amount));
    if (newAmountText === null) return;
    const newAmount = Number(newAmountText);
    if (!newTitle.trim() || !Number.isFinite(newAmount) || newAmount <= 0) return;

    if (kind === 'expense') {
      const otherExpenses = expenses.filter((record) => record.id !== id)
        .reduce((sum, record) => sum + Number(record.amount), 0);
      const available = Number(wallet?.initial_balance || 0) +
        incomes.reduce((sum, record) => sum + Number(record.amount), 0) - otherExpenses;
      if (newAmount > available) return;
    }

    const { error } = await supabase.from(table).update({
      title: newTitle.trim(), amount: newAmount
    }).eq('id', id).eq('user_id', user.id);
    if (error) return;
    await refresh();
  }

  $('#incomeList').addEventListener('click', handleHistoryAction);
  $('#expenseList').addEventListener('click', handleHistoryAction);

  try {
    await refresh();
  } catch (error) {
    console.error('ARGUS dashboard error:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthPage().catch((error) => console.error('ARGUS auth error:', error));
  initDashboard().catch((error) => console.error('ARGUS dashboard init error:', error));
});
