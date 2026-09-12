// ------------------------------------------------------------------
// SUPABASE SETUP
// The URL and anon (public) key below are SAFE to expose in frontend
// code. Supabase is designed this way — access to your data is
// controlled by Row Level Security (RLS) policies on the database
// side, not by hiding this key. Never put your Paystack SECRET key
// here though — that one must stay on the server (see /api files).
// ------------------------------------------------------------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qsktesfizdmfbsmpdxud.supabase.co/rest/v1/'; // e.g. https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFza3Rlc2ZpemRtZmJzbXBkeHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDEzMzksImV4cCI6MjEwNDc3NzMzOX0.uSTuqs6xhxhEaXwYSOAT1hpMExaDGLi63403TGQgoec';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The fixed faculty due amount, in Naira. Adjust as needed, or later
// make this dynamic (e.g. different amounts per department/level).
const DUE_AMOUNT_NGN = 100;

// ------------------------------------------------------------------
// ELEMENT REFERENCES
// ------------------------------------------------------------------
const lookupSection = document.getElementById('lookup-section');
const detailsSection = document.getElementById('details-section');

const codeInput = document.getElementById('code-input');
const lookupBtn = document.getElementById('lookup-btn');
const lookupError = document.getElementById('lookup-error');

const studentNameEl = document.getElementById('student-name');
const studentDeptEl = document.getElementById('student-department');
const emailInput = document.getElementById('email-input');
const phoneInput = document.getElementById('phone-input');
const detailsError = document.getElementById('details-error');

const payBtn = document.getElementById('pay-btn');
const backBtn = document.getElementById('back-btn');
const loadingText = document.getElementById('loading-text');

let currentStudent = null; // holds { code, full_name, department } once found

// ------------------------------------------------------------------
// STEP 1: Look up the student by code
// ------------------------------------------------------------------
lookupBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  lookupError.textContent = '';

  if (!code) {
    lookupError.textContent = 'Please enter your student code.';
    return;
  }

  setLoading(true);

  const { data, error } = await supabase
    .from('students')
    .select('code, full_name, department')
    .eq('code', code)
    .single();

  setLoading(false);

  if (error || !data) {
    lookupError.textContent = 'No student found with that code. Please check and try again.';
    return;
  }

  currentStudent = data;
  studentNameEl.textContent = data.full_name;
  studentDeptEl.textContent = data.department;

  showSection(detailsSection);
});

// ------------------------------------------------------------------
// Go back to the code lookup step
// ------------------------------------------------------------------
backBtn.addEventListener('click', () => {
  showSection(lookupSection);
});

// ------------------------------------------------------------------
// STEP 2: Validate contact info, then start the Paystack payment
// ------------------------------------------------------------------
payBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  detailsError.textContent = '';

  if (!isValidEmail(email)) {
    detailsError.textContent = 'Please enter a valid email address.';
    return;
  }

  if (!isValidPhone(phone)) {
    detailsError.textContent = 'Please enter a valid phone number.';
    return;
  }

  setLoading(true);

  try {
    const response = await fetch('/api/initialize-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        phone,
        code: currentStudent.code,
        full_name: currentStudent.full_name,
        department: currentStudent.department,
        amount: DUE_AMOUNT_NGN,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.authorization_url) {
      throw new Error(result.error || 'Could not start payment. Please try again.');
    }

    // Redirect the user to Paystack's hosted checkout page
    window.location.href = result.authorization_url;

  } catch (err) {
    setLoading(false);
    detailsError.textContent = err.message;
  }
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function showSection(sectionToShow) {
  [lookupSection, detailsSection].forEach((s) => s.classList.remove('active'));
  sectionToShow.classList.add('active');
}

function setLoading(isLoading) {
  loadingText.style.display = isLoading ? 'block' : 'none';
  lookupBtn.disabled = isLoading;
  payBtn.disabled = isLoading;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9+]{10,14}$/.test(phone);
}
