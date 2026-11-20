// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMiss(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return '×' + n.toFixed(2);
  }
  function fmtOdds(o) {
    if (o === null || o === undefined || !isFinite(o)) return 'n/a';
    return (o * 100).toFixed(0) + '%';
  }
  // The model in one function: the page recomputes a row from the fitted parameters and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  // The multiple is the fitted size curve (intercept + slope x (ln TVL - mean ln TVL)) plus the
  // protocol's family offset when it has one, clipped to the curve's range. The odds are the fitted
  // logistic on age in years and ln TVL; a protocol with no listed date takes the median known age.
  // All parameters are computed from the snapshot by main.ts, never typed in here.
  var FAMILY_LABELS = { curator: 'Curator family', staking: 'Staking family' };
  function fittedMultiple(row) {
    var sc = DATA.size_curve;
    var off = 0;
    if (row.multiple_family) {
      var f = (DATA.family_offsets || []).filter(function (x) { return x.family === row.multiple_family; })[0];
      if (f) off = f.offset;
    }
    return Math.min(sc.high_clip, Math.max(sc.low_clip, Math.exp(sc.intercept + sc.slope * (Math.log(row.tvl_usd) - sc.lntvl_mean) + off)));
  }
  function tokenOdds(row) {
    var o = DATA.odds;
    var ageY = row.age_days === null || row.age_days === undefined ? o.unknown_age_years : Math.min(Math.max(row.age_days / 365, 0), DATA.model.odds_age_cap_years);
    var eta = o.intercept + o.age_coef * ageY + o.lntvl_coef * (Math.log(row.tvl_usd) - o.lntvl_mean);
    return 1 / (1 + Math.exp(-Math.min(30, Math.max(-30, eta))));
  }
  function ifLaunchesOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * fittedMultiple(row)));
  }
  function impliedOf(row) {
    return Math.max(1, Math.round(ifLaunchesOf(row) * tokenOdds(row)));
  }
  function fmtMultiple(row) {
    if (row.multiple === null || row.multiple === undefined) return 'n/a';
    return row.multiple.toFixed(4) + ' (n=' + row.multiple_n + ')';
  }
  // The farm plan's own numbers, the same derivation main.ts writes to board.json: capital, hold,
  // gas and active hours from the protocol's TVL and age. The verdict is the plan's expected drop
  // (odds x if-it-launches x capital / TVL) less gas, per active hour.
  function planCost(row) {
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var weeks = hold / 7;
    return {
      capital_usd: capital,
      hold_days: hold,
      gas_usd: 3 + (capital >= 150 ? 8 : 4) + 2 * weeks,
      active_hours: (5 + 15 + 10 * weeks + 10 + 5) / 60
    };
  }
  function verdictOf(row) {
    var cost = planCost(row);
    var expected = tokenOdds(row) * ifLaunchesOf(row) * (cost.capital_usd / row.tvl_usd);
    var net = expected - cost.gas_usd;
    var netPerHour = net / cost.active_hours;
    var verdict = netPerHour >= DATA.model.worth_net_per_hour_usd ? 'worth' : net > 0 ? 'marginal' : 'skip';
    return { verdict: verdict, expected_drop_usd: expected, gas_usd: cost.gas_usd, active_hours: cost.active_hours, net_usd: net, net_per_hour_usd: netPerHour };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c === 'chain') return 'Bridge $' + capital + ' of USDC to ' + chain + ' and use a native app there, such as a swap or a deposit, so the on-chain activity is recorded.';
    if (c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + ' of USDC into the basis-trading vault of ' + name + ' on ' + chain + ' and hold the position.';
    if (c.indexOf('payments') >= 0) return 'Open a payment channel with $' + capital + ' through ' + name + ' and make several small payments through it.';
    if (c.indexOf('governance incentives') >= 0) return 'Lock or stake $' + capital + ' for the governance incentives of ' + name + ' and take part in any vote that runs.';
    if (c.indexOf('collateral') >= 0) return 'Deposit $' + capital + ' as collateral through ' + name + ' on ' + chain + ' and keep the receipt.';
    if (c.indexOf('cedefi') >= 0) return 'Deposit $' + capital + ' of USDC into the CeDeFi vault of ' + name + ' on ' + chain + ' and keep the shares.';
    if (c.indexOf('stablecoin wrapper') >= 0) return 'Wrap or mint $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('restaking') >= 0) return 'Restake $' + capital + ' of the restaking asset through ' + name + ' on ' + chain + ' and keep the receipt.';
    if (c.indexOf('staking pool') >= 0) return 'Stake $' + capital + ' into the ' + name + ' pool on ' + chain + ' and keep the receipt.';
    if (c.indexOf('lend') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('cdp') >= 0) return 'Deposit $' + capital + ' of collateral to mint the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.multiple === null || a.multiple === undefined ? -Infinity : a.multiple; bv = b.multiple === null || b.multiple === undefined ? -Infinity : b.multiple; }
      else if (key === 'iflaunches') { av = a.if_launches_usd; bv = b.if_launches_usd; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'verdict') { av = a.verdict === 'worth' ? 2 : a.verdict === 'marginal' ? 1 : 0; bv = b.verdict === 'worth' ? 2 : b.verdict === 'marginal' ? 1 : 0; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record, plus ' + DATA.early_size + ' pre-token protocols below that floor. Implied value is the value if a token launches, weighted by the chance one launches — a model, not a promise.' })
      )
    );
  }

  function termBy(terms, name) {
    var t = terms.filter(function (x) { return x.term === name; })[0];
    return t || null;
  }
  function kpiStrip() {
    var flat = termBy(DATA.value_terms, 'Flat global median');
    var fin = termBy(DATA.value_terms, '+ staking offset');
    var valueTested = DATA.value_terms.filter(function (t) { return t.term.indexOf('Control') !== 0; });
    var valueKept = valueTested.filter(function (t) { return t.kept; }).length;
    var oddsKept = DATA.odds_terms.filter(function (t) { return t.kept; }).length;
    var vc = DATA.verdict_counts;
    var best = DATA.best_farm;
    function card(label, value, sub) {
      return el('div', { class: 'kpi-card' }, el('span', { text: label }), el('b', { text: value }), el('span', { class: 'sub', text: sub }));
    }
    return el('section', { class: 'kpi', 'aria-label': 'Model evidence at a glance' },
      card('Out-of-sample miss, leave-one-out', fin ? fmtMiss(fin.loo_miss) : 'n/a', flat ? 'flat global median ' + fmtMiss(flat.loo_miss) : ''),
      card('Range honesty, held out', Math.round(DATA.range.coverage_loo * 100) + '% in range', 'stated ' + Math.round(DATA.range.stated_coverage * 100) + '% (P25–P75)'),
      card('Token odds Brier, leave-one-out', DATA.odds.brier_loo.toFixed(4), 'base rate ' + DATA.odds.brier_base.toFixed(4)),
      card('Terms kept', valueKept + ' of ' + valueTested.length + ' value · ' + oddsKept + ' of ' + DATA.odds_terms.length + ' odds', 'only terms that never worsen a held-out test'),
      el('div', { class: 'kpi-card' },
        el('span', { text: 'Worth farming' }),
        el('b', { text: vc.worth + ' of ' + DATA.board_size }),
        el('span', { class: 'sub', text: vc.marginal + ' marginal · ' + vc.skip + ' skip' }),
        el('span', { class: 'sub', text: 'best $' + best.net_per_hour_usd.toFixed(2) + '/h — ' + best.name + ' (bar $' + DATA.model.worth_net_per_hour_usd + '/h)' })
      ),
      card('Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, DATA.board_size + ' rows, ' + DATA.early_size + ' early')
    );
  }

  function evidenceTable(title, terms, caption) {
    var body = el('tbody');
    terms.forEach(function (t) {
      var verdict = t.kept ? 'kept' : t.term.indexOf('Control') === 0 ? 'control' : t.term.indexOf('Base') === 0 || t.term.indexOf('Flat') === 0 ? 'baseline' : 'dropped';
      body.appendChild(el('tr', null,
        el('td', null, el('b', { text: t.term })),
        el('td', { class: 'num', text: fmtMiss(t.loo_miss) }),
        el('td', { class: 'num', text: fmtMiss(t.wf_miss) }),
        el('td', { class: 'num', text: fmtMiss(t.wf2_miss) }),
        el('td', { class: 'num', text: fmtMiss(t.wf3_miss) }),
        el('td', null, el('span', { class: 'verdict ' + verdict, text: verdict }))
      ));
    });
    var medCut = terms.filter(function (t) { return t.wf2_cut; })[0];
    var thirdCut = terms.filter(function (t) { return t.wf3_cut; })[0];
    return el('div', { class: 'evidence-table' },
      el('h3', { text: title }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: caption }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Term' }),
            el('th', { scope: 'col', text: 'Leave-one-out' }),
            el('th', { scope: 'col', text: 'WF ' + DATA.walk_forward_cut }),
            el('th', { scope: 'col', text: 'WF ' + (medCut ? medCut.wf2_cut : 'median date') }),
            el('th', { scope: 'col', text: 'WF ' + (thirdCut ? thirdCut.wf3_cut : 'third cut') }),
            el('th', { scope: 'col', text: 'Verdict' })
          )),
          body
        )
      )
    );
  }

  function evidenceSection() {
    var perm = DATA.permutation;
    var beatStaking = Math.round((1 - perm.staking.p_value) * perm.shuffles);
    var beatCurator = Math.round((1 - perm.curator.p_value) * perm.shuffles);
    return el('section', { class: 'panel evidence' },
      el('div', { class: 'evidence-head' },
        el('h2', { text: 'Held-out evidence: every term tested four ways' }),
        el('p', { class: 'sub', text: 'A term is kept only when it never worsens the miss in leave-one-out or in any of the three walk-forward cuts. The miss is the typical factor by which a prediction is wrong: exp(median |ln(pred / actual)|). The permutation check shuffles each family label 200 times, so a real family signal must beat most shuffles.' })
      ),
      el('div', { class: 'evidence-grid' },
        evidenceTable('Value: what a token would be worth', DATA.value_terms, 'Fitted on the ' + DATA.size_curve.n + ' token-bearing comparators. Walk-forward fits on protocols listed before the cut and tests on those listed after it.'),
        evidenceTable('Token odds: will it launch one', DATA.odds_terms, 'Fitted on the ' + DATA.odds.labeled_n + ' protocols whose token status is known. Brier score: lower is better, 0 is perfect.')
      ),
      el('p', { class: 'sub', text: 'Permutation check (' + perm.shuffles + ' shuffles): the staking offset beats ' + beatStaking + ' of ' + perm.shuffles + ' random labelings (p = ' + perm.staking.p_value.toFixed(3) + ', shuffled miss ' + fmtMiss(perm.staking.mean_miss) + ' on average, real ' + fmtMiss(perm.staking.real_miss) + '); the curator offset beats ' + beatCurator + ' of ' + perm.shuffles + ' (p = ' + perm.curator.p_value.toFixed(3) + ', shuffled miss ' + fmtMiss(perm.curator.mean_miss) + ', real ' + fmtMiss(perm.curator.real_miss) + ') — a small, stable staking signal and curator noise. Radar-4 kept the curator offset on one deterministic shuffle; 200 shuffles show that draw was luck.' })
    );
  }

  function accountingStrip() {
    var total = DATA.accounting.reduce(function (a, g) { return a + g.count; }, 0);
    var chips = DATA.accounting.map(function (g) {
      return el('span', { class: 'chip', text: g.label + ': ' + g.count });
    });
    return el('section', { class: 'account' },
      el('b', { text: 'All ' + total + ' snapshot protocols accounted for' }),
      el('div', { class: 'chips' }, chips)
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMultiple(r) }),
        el('td', { class: 'num', text: fmtUsd(r.if_launches_usd) }),
        el('td', { class: 'num', text: fmtOdds(r.token_odds) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('div', { class: 'name' },
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
            el('span', { class: 'sub', text: fmtUsd(r.range_low_usd) + ' – ' + fmtUsd(r.range_high_usd) })
          )
        )),
        el('td', null, el('span', { class: 'verdict ' + r.verdict, text: r.verdict === 'worth' ? 'worth farming' : r.verdict === 'marginal' ? 'marginal' : 'skip' }),
          r.multiple_source === 'family' ? el('span', { class: 'tag family', text: (FAMILY_LABELS[r.multiple_family] || 'family') + ' offset' }) : null)
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first — the value if a token launches, weighted by the chance one launches. Select a row for its model, farm verdict and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Multiple (n)'),
            sortHeader('iflaunches', 'If it launches'),
            sortHeader('odds', 'Token odds'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Farm verdict' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function familyMultiple(label) {
    var f = (DATA.families || []).filter(function (m) { return m.category === label; })[0];
    return f ? f.multiple.toFixed(4) + ' (n=' + f.n + ')' : 'n/a';
  }

  function multiplesTable() {
    var rows = DATA.multiples.map(function (m) {
      return el('tr', null,
        el('td', { text: m.category }),
        el('td', { class: 'num', text: String(m.n) }),
        el('td', { class: 'num', text: m.multiple.toFixed(4) })
      );
    });
    (DATA.families || []).forEach(function (m) {
      rows.push(el('tr', null,
        el('td', null, el('b', { text: m.category + ' (pooled categories)' })),
        el('td', { class: 'num', text: String(m.n) }),
        el('td', { class: 'num', text: m.multiple.toFixed(4) })
      ));
    });
    rows.push(el('tr', null,
      el('td', null, el('b', { text: 'Global median (all categories)' })),
      el('td', { class: 'num', text: String(DATA.global_n) }),
      el('td', { class: 'num', text: DATA.global_multiple.toFixed(4) })
    ));
    return el('div', { class: 'table-wrap multiples' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Median market-cap / TVL of token-bearing protocols, per category and per family. These medians are reference evidence only: the fitted multiple does not use them. A category median backed by fewer than 3 comparators is never used on its own.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category / family' }), el('th', { scope: 'col', text: 'Comparators (n)' }), el('th', { scope: 'col', text: 'Multiple' }))),
        el('tbody', null, rows)
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var sc = DATA.size_curve;
    var o = DATA.odds;
    var vc = DATA.verdict_counts;
    var offsets = DATA.family_offsets.map(function (f) {
      return el('tr', null,
        el('td', { text: f.label }),
        el('td', { class: 'num', text: f.offset.toFixed(4) }),
        el('td', { class: 'num', text: '×' + f.multiplier.toFixed(4) }),
        el('td', { class: 'num', text: String(f.n) })
      );
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. Each term was tested held out four ways — leave-one-out and three walk-forward cuts (see "Held-out evidence" above); only terms that never worsen the miss in any test are in the model.' }),
      el('div', { class: 'formula' },
        'multiple = clamp( exp( ' + sc.intercept.toFixed(4) + ' + ' + sc.slope.toFixed(4) + ' x (ln tvl_usd - ' + sc.lntvl_mean.toFixed(4) + ') + staking offset ), ' + sc.low_clip + ', ' + sc.high_clip + ' )',
        el('br'),
        'if it launches = round( tvl_usd x multiple )',
        el('br'),
        'odds = logistic( ' + o.intercept.toFixed(4) + ' + ' + o.age_coef.toFixed(4) + ' x age in years + ' + o.lntvl_coef.toFixed(4) + ' x (ln tvl_usd - ' + o.lntvl_mean.toFixed(4) + ') )',
        el('br'),
        'implied = round( if it launches x odds )',
        el('br'),
        'range = [ implied x ' + DATA.range.low_factor.toFixed(4) + ', implied x ' + DATA.range.high_factor.toFixed(4) + ' ]'
      ),
      el('p', { class: 'sub', text: 'The multiple is a size curve fitted on all ' + sc.n + ' token-bearing comparators: ln(market-cap / TVL) on ln TVL, intercept ' + sc.intercept.toFixed(4) + ', slope ' + sc.slope.toFixed(4) + '. Larger protocols carry lower multiples, and the curve says so by ' + Math.abs(sc.slope).toFixed(2) + ' in log terms per unit of ln TVL. The staking offset is the median residual of the staking family\u2019s comparators, used only when the family has at least 5 comparators; it lowers the mean |log error| in all four held-out tests and its fitted value is stable across walk-forward train sets, so it stays. The curator offset was tested the same way and dropped: it worsens leave-one-out, 155 of 200 shuffled curator labelings do as well or better (p = ' + DATA.permutation.curator.p_value.toFixed(3) + '), and its fitted value flips sign across train sets. A thin category never gets its own multiple, because one or two observations is an anecdote, not an estimate. The category medians below are reference evidence only — the fitted multiple does not use them. The median is used, never the mean: the ratio distribution is extremely skewed (global mean about 5.0 against a median of ' + DATA.global_multiple.toFixed(4) + '), so a mean would let one outlier dictate a whole rank.' }),
      el('div', { class: 'table-wrap multiples' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Staking offset on the size curve: the median residual of the staking family\u2019s comparators. The curator offset was tested and dropped — see "Held-out evidence".' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Family' }), el('th', { scope: 'col', text: 'Offset (log)' }), el('th', { scope: 'col', text: 'Multiplier' }), el('th', { scope: 'col', text: 'Comparators (n)' }))),
          el('tbody', null, offsets)
        )
      ),
      el('p', { class: 'sub', text: 'Token odds are a logistic regression on age in years (capped at ' + m.odds_age_cap_years + ') and ln TVL, fitted on the ' + o.labeled_n + ' protocols whose token status is known (not an exchange, not a versioned pool). A protocol with no listed date takes the median known age of ' + o.unknown_age_years.toFixed(2) + ' years. The base rate of peers is ' + (o.base_rate * 100).toFixed(1) + '%; the model scores Brier ' + o.brier_loo.toFixed(4) + ' leave-one-out against ' + o.brier_base.toFixed(4) + ' for the base rate, ' + o.brier_wf.toFixed(4) + ' on the ' + o.wf_cut + ' walk-forward against ' + termBy(DATA.odds_terms, 'Base rate of peers').wf_miss.toFixed(4) + ', ' + o.brier_wf_med.toFixed(4) + ' on the ' + o.wf_cut2 + ' walk-forward against ' + termBy(DATA.odds_terms, 'Base rate of peers').wf2_miss.toFixed(4) + ', and ' + o.brier_wf3.toFixed(4) + ' on the ' + o.wf_cut3 + ' walk-forward against ' + termBy(DATA.odds_terms, 'Base rate of peers').wf3_miss.toFixed(4) + '. Family dummies, the age x ln TVL interaction, seven-day growth in both forms and chain count were tested for the odds and did not lower all four, so they are not in it.' }),
      el('p', { class: 'sub', text: 'The range is the P25–P75 band of the value model\u2019s leave-one-out log-errors (actual / predicted): implied x ' + DATA.range.low_factor.toFixed(4) + ' to implied x ' + DATA.range.high_factor.toFixed(4) + '. Held out, the actual value lands inside the printed range ' + Math.round(DATA.range.coverage_loo * 100) + '% of the time, against a stated ' + Math.round(DATA.range.stated_coverage * 100) + '%. The band is wide because the multiple is noisy: a single protocol\u2019s value is uncertain by a factor of several, and the board ranks expected values, not certainties.' }),
      el('p', { class: 'sub', text: 'The farm verdict is a scenario, not a promise. The expected drop is odds x if-it-launches x (capital / TVL): the farmer\u2019s pro-rata share if the whole launch value went to depositors. Net is the drop less gas; per hour divides by the plan\u2019s active hours. Worth farming needs net per hour of at least $' + m.worth_net_per_hour_usd + '. On this board ' + vc.worth + ' row' + (vc.worth === 1 ? ' is' : 's are') + ' worth farming, ' + vc.marginal + ' marginal and ' + vc.skip + ' skip. The best plan on this board is ' + DATA.best_farm.name + ' at $' + DATA.best_farm.net_per_hour_usd.toFixed(2) + '/h, still below the $' + m.worth_net_per_hour_usd + '/h bar — the threshold is not lowered to manufacture a winner. A points-based allocation could pay more or nothing, so no verdict promises a reward.' }),
      multiplesTable(),
      el('p', { class: 'sub', text: 'What this model cannot say: the multiple is cross-sectional evidence, not a cause. The snapshot carries no fees, revenue, users or airdrop flag, so TVL is the only size proxy available, and the implied value is a model claim, not a prediction of a launch, a price or a reward. The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row);
    var v = verdictOf(row);
    var ageY = row.age_days === null || row.age_days === undefined ? DATA.odds.unknown_age_years : Math.min(Math.max(row.age_days / 365, 0), DATA.model.odds_age_cap_years);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Multiple (n)' }), el('b', { class: 'num', text: fittedMultiple(row).toFixed(4) + ' (n=' + row.multiple_n + ')' + (row.multiple_source === 'family' ? ' — ' + (FAMILY_LABELS[row.multiple_family] || 'family') + ' offset' : ' — size curve') })),
        el('div', null, el('span', { text: 'If it launches' }), el('b', { class: 'num', text: fmtUsd(ifLaunchesOf(row)) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) + (row.age_days === null ? ' (median known age ' + DATA.odds.unknown_age_years.toFixed(2) + 'y used)' : '') })),
        el('div', null, el('span', { text: 'Token odds' }), el('b', { class: 'num', text: fmtOdds(tokenOdds(row)) + ' (age ' + ageY.toFixed(2) + 'y)' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Range (P25–P75)' }), el('b', { class: 'num', text: fmtUsd(row.range_low_usd) + ' – ' + fmtUsd(row.range_high_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + ' (if it launches ' + fmtUsd(ifLaunchesOf(row)) + ' x odds ' + fmtOdds(tokenOdds(row)) + ')' + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm verdict' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Verdict' }), el('b', { class: 'num', text: row.verdict === 'worth' ? 'worth farming' : row.verdict === 'marginal' ? 'marginal' : 'skip' })),
        el('div', null, el('span', { text: 'Expected drop' }), el('b', { class: 'num', text: fmtUsd(row.expected_drop_usd) })),
        el('div', null, el('span', { text: 'Gas' }), el('b', { class: 'num', text: fmtUsd(row.gas_usd) })),
        el('div', null, el('span', { text: 'Active hours' }), el('b', { class: 'num', text: row.active_hours.toFixed(2) + 'h' })),
        el('div', null, el('span', { text: 'Net' }), el('b', { class: 'num', text: (row.net_usd < 0 ? '−' : '') + fmtUsd(Math.abs(row.net_usd)) })),
        el('div', null, el('span', { text: 'Net per hour' }), el('b', { class: 'num', text: '$' + row.net_per_hour_usd.toFixed(2) + '/h' }))
      ),
      el('p', { class: 'sub', text: 'The page recomputes this verdict as ' + v.verdict + ' (net $' + v.net_usd.toFixed(2) + ', $' + v.net_per_hour_usd.toFixed(2) + '/h)' + (v.verdict === row.verdict ? ', the same as the board.' : ', which differs from the board: the data would be stale.') + ' Worth farming needs $' + DATA.model.worth_net_per_hour_usd + '/h. The expected drop is the farmer\u2019s pro-rata share if the whole launch value went to depositors; a points-based allocation could pay more or nothing.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(kpiStrip());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    shell.appendChild(accountingStrip());
    shell.appendChild(evidenceSection());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
