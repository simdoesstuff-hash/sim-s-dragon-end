// ====== CONFIGURE SUPABASE ======
const SUPABASE_URL = "https://owfjbkyzzbxikrkqqlli.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Zmpia3l6emJ4aWtya3FxbGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MTg0MTcsImV4cCI6MjA3MzI5NDQxN30.pezhr3hJhtkBJ8HjMWq3v9Q0kdtYcUMeDLIFBHcBwR0";

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

// Get client IP (using a free IP API)
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP:', error);
    // Fallback: generate a unique ID for this session
    return 'session-' + Math.random().toString(36).substr(2, 9);
  }
}

// Check if user has already voted
async function hasUserVoted() {
  try {
    const ip = await getClientIP();
    const { data, error } = await client
      .from('voter_ips')
      .select('ip_address')
      .eq('ip_address', ip)
      .single();
    
    return !error && data !== null;
  } catch (error) {
    console.error('Error checking vote status:', error);
    return false;
  }
}

// Record that user has voted
async function recordVote() {
  try {
    const ip = await getClientIP();
    const { error } = await client
      .from('voter_ips')
      .insert([{ ip_address: ip }]);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error recording vote:', error);
    return false;
  }
}

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

// Check vote status on page load
async function initializePoll() {
  const hasVoted = await hasUserVoted();
  if (hasVoted) {
    form.classList.add('hidden');
    resultsDiv.classList.remove('hidden');
  }
  await loadResults();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Check if already voted
  const hasVoted = await hasUserVoted();
  if (hasVoted) {
    alert('You have already voted! Each IP address can only vote once.');
    form.classList.add('hidden');
    resultsDiv.classList.remove('hidden');
    return;
  }

  const checked = Array.from(document.querySelectorAll('input[name="poll"]:checked'));
  if (checked.length === 0 || checked.length > 3) {
    alert('Please select between 1 and 3 options.');
    return;
  }

  try {
    // Use direct update
    for (let checkbox of checked) {
      const optionValue = checkbox.value;
      
      console.log('Voting for:', optionValue);
      
      // Get current count first
      const { data: currentData, error: selectError } = await client
        .from('poll_votes')
        .select('count')
        .eq('option', optionValue)
        .single();
        
      if (selectError) {
        console.error('Select error:', selectError);
        continue;
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
    
    // Record that this IP has voted
    const recorded = await recordVote();
    if (!recorded) {
      alert('There was an issue recording your vote. Please try again.');
      return;
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

// Initialize the poll
initializePoll();
