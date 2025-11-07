// ====== CONFIGURE SUPABASE ======
const SUPABASE_URL = "https://owfjbkyzzbxikrkqqlli.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Zmpia3l6emJ4aWtya3FxbGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MTg0MTcsImV4cCI6MjA3MzI5NDQxN30.pezhr3hJhtkBJ8HjMWq3v9Q0kdtYcUMeDLIFBHcBwR0";

// The UMD bundle exposes a global named `window.supabase`
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ====== DROPDOWN TOGGLES ======
document.querySelectorAll('.dropdown-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const content = btn.nextElementSibling;
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
  });
});

// ====== POLL LOGIC ======
const form = document.getElementById('poll-form');
const resultsDiv = document.getElementById('results');
const resultsList = document.getElementById('results-list');

async function loadResults() {
  try {
    const { data, error } = await client
      .from('poll_votes')
      .select('option, count')
      .order('id', { ascending: true });

    if (error) throw error;

    resultsList.innerHTML = '';
    data.forEach(row => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${row.option}</span><strong>${row.count}</strong>`;
      resultsList.appendChild(li);
    });
  } catch (err) {
    console.error('loadResults error:', err);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const checked = Array.from(document.querySelectorAll('input[name="poll"]:checked'));
  if (checked.length === 0 || checked.length > 3) {
    alert('Please select between 1 and 3 options.');
    return;
  }

  try {
    // Use direct update instead of RPC
    for (let checkbox of checked) {
      // Get the option value from the checkbox (this should match your database)
      const optionValue = checkbox.value;
      
      console.log('Voting for:', optionValue); // Debug log
      
      // Get current count first
      const { data: currentData, error: selectError } = await client
        .from('poll_votes')
        .select('count')
        .eq('option', optionValue)
        .single();
        
      if (selectError) {
        console.error('Select error:', selectError);
        continue; // Skip this option if there's an error
      }
      
      // Update count directly
      const { error: updateError } = await client
        .from('poll_votes')
        .update({ count: currentData.count + 1 })
        .eq('option', optionValue);
        
      if (updateError) {
        console.error('Update error:', updateError);
      }
    }
    
    // Hide form and show results
    form.classList.add('hidden');
    resultsDiv.classList.remove('hidden');
    await loadResults();
    
  } catch (err) {
    console.error('Submit error:', err);
    alert('Error submitting vote. Please try again.');
  }
});

// ====== LIVE UPDATES ======
client
  .channel('realtime-poll')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'poll_votes' },
    () => loadResults()
  )
  .subscribe();

loadResults();