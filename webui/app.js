const textEl = document.getElementById('text');
const referencesEl = document.getElementById('references');
const brandbookEl = document.getElementById('brandbook');
const buttonEl = document.getElementById('validateButton');
const resultEl = document.getElementById('result');
const statusEl = document.getElementById('status');
const scoreBadgeEl = document.getElementById('scoreBadge');

referencesEl.value = [
  'C:\\Users\\ChianelloAna(BipGrou\\OneDrive - BUSINESS INTEGRATION PARTNERS SPA\\Documenti\\New project\\data\\reference-posts'
].join('\n');

brandbookEl.value = 'C:\\Users\\ChianelloAna(BipGrou\\Downloads\\BIP Brand Guidelines 2025 (1).pdf';
textEl.value = 'A governança de dados fortalece a conformidade e a tomada de decisão com linguagem institucional.';

buttonEl.addEventListener('click', async () => {
  const payload = {
    text: textEl.value.trim(),
    reference_paths: referencesEl.value
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
    brandbook_path: brandbookEl.value.trim()
  };

  if (!payload.text) {
    statusEl.textContent = 'Enter content before validating.';
    return;
  }

  buttonEl.disabled = true;
  statusEl.textContent = 'Validating...';
  resultEl.textContent = '{}';
  scoreBadgeEl.textContent = '-';
  scoreBadgeEl.classList.add('hidden');

  try {
    const response = await fetch('/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    resultEl.textContent = JSON.stringify(data, null, 2);

    if (typeof data.final_score === 'number') {
      scoreBadgeEl.textContent = data.final_score.toFixed(2);
      scoreBadgeEl.classList.remove('hidden');
    }

    statusEl.textContent = response.ok ? 'Validation completed.' : 'Validation failed.';
  } catch (error) {
    resultEl.textContent = JSON.stringify({ error: error.message }, null, 2);
    statusEl.textContent = 'Request failed.';
  } finally {
    buttonEl.disabled = false;
  }
});
