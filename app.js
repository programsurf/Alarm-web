// 전역 상태
let allConferences = [];
let currentFilter = 'all';
let currentSort = 'deadline';

// DOM 요소
const conferenceList = document.getElementById('conferenceList');
const loading = document.getElementById('loading');
const categoryFilter = document.getElementById('categoryFilter');
const sortSelect = document.getElementById('sortSelect');

// 초기화
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // 이벤트 리스너 설정
    categoryFilter.addEventListener('click', handleCategoryClick);
    sortSelect.addEventListener('change', handleSortChange);

    // 데이터 로드
    await loadConferences();
}

// 카테고리 필터 클릭
function handleCategoryClick(e) {
    if (!e.target.classList.contains('filter-btn')) return;

    categoryFilter.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.category;
    renderConferences();
}

// 정렬 변경
function handleSortChange(e) {
    currentSort = e.target.value;
    renderConferences();
}

// ccfddl에서 학회 데이터 가져오기 (Python의 fetch_ccfddl_conference와 동일)
async function fetchConference(sub, name) {
    const url = `https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference/${sub}/${name}.yml`;

    try {
        const response = await fetch(url);
        if (response.status === 200) {
            const text = await response.text();
            const data = jsyaml.load(text);
            console.log(`[DEBUG] ${sub}/${name}:`, data);
            return data;
        }
    } catch (e) {
        console.error(`[ccfddl] Error fetching ${sub}/${name}:`, e);
    }

    return null;
}

// 데드라인 문자열 파싱 (Python의 parse_deadline과 동일)
function parseDeadline(deadlineStr) {
    if (!deadlineStr) return null;

    let cleanStr = String(deadlineStr).trim().replace(/['"]/g, '');

    if (['TBD', 'TBA', 'N/A'].some(x => cleanStr.toUpperCase().includes(x))) {
        return null;
    }

    const formats = [
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
        /^(\d{4})-(\d{2})-(\d{2})$/,
    ];

    for (const fmt of formats) {
        const match = cleanStr.match(fmt);
        if (match) {
            const [, year, month, day, hour = '23', minute = '59', second = '59'] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
                          parseInt(hour), parseInt(minute), parseInt(second));
        }
    }

    return null;
}

// KST로 변환 (Python의 convert_to_kst와 동일)
function convertToKST(deadline, timezoneStr) {
    const offsetMinutes = TIMEZONE_OFFSETS[timezoneStr] ?? -720; // 기본값 AoE (UTC-12)

    // deadline을 해당 타임존의 시간으로 간주하고 UTC로 변환
    const utcTime = deadline.getTime() - (offsetMinutes * 60 * 1000);
    // UTC를 KST로 변환 (KST = UTC+9 = +540분)
    const kstTime = utcTime + (KST_OFFSET * 60 * 1000);

    return new Date(kstTime);
}

// 학회 정보 수집 (Python의 collect_conferences와 동일)
async function collectConferences() {
    const conferences = [];

    const promises = CONFERENCES.map(async ({ sub, name }) => {
        const data = await fetchConference(sub, name);
        if (!data) {
            console.log(`[DEBUG] ${sub}/${name}: no data`);
            return [];
        }

        const results = [];

        // Python에서 for conf in data: 로 순회 - data는 리스트
        const confList = Array.isArray(data) ? data : [data];
        console.log(`[DEBUG] ${sub}/${name} confList length:`, confList.length);

        for (const conf of confList) {
            const title = conf.title || '';
            const description = conf.description || '';
            const rank = conf.rank?.ccf || '';

            for (const cycle of conf.confs || []) {
                const year = cycle.year || '';
                const link = cycle.link || '';
                const place = cycle.place || 'TBA';
                const date = cycle.date || 'TBA';
                const timezone = cycle.timezone || 'UTC-12';

                // 모든 timeline을 하나의 리스트로
                const timelines = [];

                for (const t of cycle.timeline || []) {
                    const comment = t.comment || '';

                    // Abstract deadline
                    const abstractStr = t.abstract_deadline;
                    const abstractDate = parseDeadline(abstractStr);
                    if (abstractDate) {
                        const abstractKST = convertToKST(abstractDate, timezone);
                        timelines.push({
                            type: 'Abstract Registration',
                            deadline: abstractDate,
                            deadlineKST: abstractKST,
                            comment: comment
                        });
                    }

                    // Paper deadline
                    const paperStr = t.deadline;
                    const paperDate = parseDeadline(paperStr);
                    if (paperDate) {
                        const paperKST = convertToKST(paperDate, timezone);
                        timelines.push({
                            type: 'Paper Submission',
                            deadline: paperDate,
                            deadlineKST: paperKST,
                            comment: comment
                        });
                    }
                }

                if (timelines.length > 0) {
                    results.push({
                        name: title,
                        fullName: description,
                        category: CATEGORY_MAP[sub] || sub,
                        ccfRank: rank,
                        year: year,
                        place: place,
                        date: date,
                        timezone: timezone,
                        link: link,
                        timelines: timelines,
                        source: 'ccfddl'
                    });
                }
            }
        }

        console.log(`[ccfddl] Fetched ${sub}/${name}`);
        return results;
    });

    const results = await Promise.all(promises);
    return results.flat();
}

// 다가오는 학회 필터링 (Python의 get_upcoming_conferences와 동일)
function getUpcomingConferences(conferences) {
    const nowKST = new Date();
    const currentYear = nowKST.getFullYear();
    const nextYear = currentYear + 1;
    const upcoming = [];

    for (const conf of conferences) {
        // 각 timeline의 days_left 계산 (KST 기준)
        const futureTimelines = [];
        let minDaysLeft = Infinity;

        for (const t of conf.timelines) {
            const deadlineKST = t.deadlineKST;
            const daysLeft = Math.floor((deadlineKST - nowKST) / (1000 * 60 * 60 * 24));

            // 미래 deadline만 포함, 현재/다음 연도만
            if (daysLeft >= 0 && deadlineKST.getFullYear() <= nextYear) {
                t.daysLeft = daysLeft;
                futureTimelines.push(t);
                minDaysLeft = Math.min(minDaysLeft, daysLeft);
            }
        }

        if (futureTimelines.length > 0) {
            conf.timelines = futureTimelines.sort((a, b) => a.deadlineKST - b.deadlineKST);
            conf.minDaysLeft = minDaysLeft;
            upcoming.push(conf);
        }
    }

    // 가장 빠른 deadline 기준 정렬
    upcoming.sort((a, b) => a.minDaysLeft - b.minDaysLeft);
    return upcoming;
}

// 학회 데이터 로드
async function loadConferences() {
    loading.classList.remove('hidden');
    conferenceList.innerHTML = '';

    console.log('=' .repeat(60));
    console.log('Conference Deadline Tracker (Web)');
    console.log(`Time: ${new Date().toLocaleString('ko-KR')}`);
    console.log('=' .repeat(60));

    // 학회 정보 수집
    const conferences = await collectConferences();
    console.log(`\nTotal collected: ${conferences.length} conference cycles`);

    // 필터링
    const upcoming = getUpcomingConferences(conferences);
    const currentYear = new Date().getFullYear();
    console.log(`Upcoming (${currentYear}-${currentYear + 1}): ${upcoming.length} conferences`);

    allConferences = upcoming;

    loading.classList.add('hidden');
    document.getElementById('updateTime').textContent = new Date().toLocaleString('ko-KR');

    renderConferences();
}

// 학회 목록 렌더링
function renderConferences() {
    // 필터링
    let filtered = allConferences;
    if (currentFilter !== 'all') {
        filtered = allConferences.filter(c => c.category === currentFilter);
    }

    // 정렬
    if (currentSort === 'deadline') {
        filtered.sort((a, b) => a.minDaysLeft - b.minDaysLeft);
    } else if (currentSort === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 통계 업데이트 (30일/6개월 기준)
    const urgent = filtered.filter(c => c.minDaysLeft <= 30).length;
    const soon = filtered.filter(c => c.minDaysLeft > 30 && c.minDaysLeft <= 180).length;
    const normal = filtered.filter(c => c.minDaysLeft > 180).length;

    document.getElementById('urgentCount').textContent = urgent;
    document.getElementById('soonCount').textContent = soon;
    document.getElementById('normalCount').textContent = normal;

    // 렌더링
    if (filtered.length === 0) {
        conferenceList.innerHTML = `
            <div class="empty-state">
                <p>표시할 학회가 없습니다.</p>
            </div>
        `;
        return;
    }

    conferenceList.innerHTML = filtered.map(conf => renderCard(conf)).join('');
}

// 긴급도 이모지 (빨강/노랑/초록 3단계)
function getUrgencyEmoji(daysLeft) {
    if (daysLeft <= 30) return '🔴';      // 30일 이내: 빨강
    if (daysLeft <= 180) return '🟡';     // 6개월 이내: 노랑
    return '🟢';                           // 6개월 초과: 초록
}

// 학회 카드 렌더링
function renderCard(conf) {
    const urgencyClass = conf.minDaysLeft <= 30 ? 'urgent' : conf.minDaysLeft <= 180 ? 'soon' : 'normal';
    const emoji = getUrgencyEmoji(conf.minDaysLeft);

    const nameLink = conf.link
        ? `<a href="${conf.link}" class="conf-name" target="_blank">${conf.name}</a>`
        : `<span class="conf-name">${conf.name}</span>`;

    const rankBadge = conf.ccfRank
        ? `<span class="badge badge-rank">CCF-${conf.ccfRank}</span>`
        : '';

    const timelines = conf.timelines.map(t => {
        const tClass = t.daysLeft <= 7 ? 'urgent' : t.daysLeft <= 30 ? 'soon' : 'normal';

        // Python과 동일한 형식: KST 시간과 원본 시간 모두 표시
        const origStr = t.deadline.toLocaleString('sv-SE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).replace('T', ' ');

        const kstStr = t.deadlineKST.toLocaleString('sv-SE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).replace('T', ' ');

        const comment = t.comment ? ` (${t.comment})` : '';

        return `
            <div class="timeline-item">
                <span class="timeline-type">${t.type}${comment}</span>
                <span class="timeline-date">${kstStr} KST / ${origStr} ${conf.timezone}</span>
                <span class="timeline-days ${tClass}">D-${t.daysLeft}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="conference-card ${urgencyClass}">
            <div class="card-header">
                <div class="conf-title">
                    <span class="urgency-emoji">${emoji}</span>
                    ${nameLink}
                    <span class="conf-year">${conf.year}</span>
                    <span class="badge badge-category">${conf.category}</span>
                    ${rankBadge}
                </div>
                <div class="days-left ${urgencyClass}">D-${conf.minDaysLeft}</div>
            </div>
            <div class="conf-meta">
                <span>📍 ${conf.place}</span>
                <span>📅 ${conf.date}</span>
                <span>🕐 ${conf.timezone}</span>
            </div>
            <div class="timeline-list">
                ${timelines}
            </div>
        </div>
    `;
}
