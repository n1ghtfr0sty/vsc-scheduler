class Calendar {
  constructor(container, options = {}) {
    this.container = container;
    this.currentDate = new Date();
    this.selectedDate = null;
    this.games = [];
    this.view = options.view || 'month';
    this.onDateClick = options.onDateClick || (() => {});
    this.onEventClick = options.onEventClick || (() => {});
    
    this.monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    this.dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    this.render();
  }
  
  setGames(games) {
    this.games = games;
    this.render();
  }
  
  setView(view) {
    this.view = view;
    this.render();
  }
  
  goToToday() {
    this.currentDate = new Date();
    this.render();
  }
  
  previousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  }
  
  previousWeek() {
    this.currentDate.setDate(this.currentDate.getDate() - 7);
    this.render();
  }

  nextWeek() {
    this.currentDate.setDate(this.currentDate.getDate() + 7);
    this.render();
  }
  
  getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  
  nextMonth() {
    if (this.view === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    }
    this.render();
  }
  
  previousYear() {
    this.currentDate.setFullYear(this.currentDate.getFullYear() - 1);
    this.render();
  }
  
  nextYear() {
    this.currentDate.setFullYear(this.currentDate.getFullYear() + 1);
    this.render();
  }
  
  getGamesForDate(date) {
    const dateStr = this.formatDate(date);
    return this.games.filter(game => game.game_date === dateStr);
  }
  
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
  
  isSameMonth(date) {
    return date.getMonth() === this.currentDate.getMonth();
  }
  
  render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    let title = '';
    if (this.view === 'month') {
      title = `${this.monthNames[month]} ${year}`;
    } else {
      const weekStart = this.getWeekStart(this.currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      title = `${this.monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${this.monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    }
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const navLabel = this.view === 'month' ? 'Month' : 'Week';
    
    let html = `
      <div class="calendar-container">
        <div class="calendar-header">
          <div class="calendar-nav">
            <button onclick="calendar.previous${navLabel}()" title="Previous ${navLabel}">&laquo;</button>
            <button class="today-btn" onclick="calendar.goToToday()">Today</button>
            <button onclick="calendar.next${navLabel}()" title="Next ${navLabel}">&raquo;</button>
          </div>
          <h2>${title}</h2>
          <div class="calendar-view-toggle">
            <button class="${this.view === 'month' ? 'active' : ''}" onclick="calendar.setView('month')">Month</button>
            <button class="${this.view === 'week' ? 'active' : ''}" onclick="calendar.setView('week')">Week</button>
          </div>
        </div>
    `;
    
    if (this.view === 'month') {
      html += this.renderMonthView(startDate, lastDay);
    } else {
      html += this.renderWeekView();
    }
    
    html += `
      <div class="calendar-legend">
        <div class="calendar-legend-item">
          <div class="calendar-legend-color" style="background: linear-gradient(135deg, var(--primary), var(--primary-dark))"></div>
          <span>Team Game</span>
        </div>
        <div class="calendar-legend-item">
          <div class="calendar-legend-color" style="background: linear-gradient(135deg, var(--gold), var(--gold-dark))"></div>
          <span>Home Game</span>
        </div>
        <div class="calendar-legend-item">
          <div class="calendar-legend-color" style="background: linear-gradient(135deg, #dc3545, #b02a37)"></div>
          <span>Conflict</span>
        </div>
      </div>
    `;
    
    html += '</div>';
    
    this.container.innerHTML = html;
  }
  
  renderMonthView(startDate, lastDay) {
    let html = '<div class="calendar-grid">';
    
    this.dayNames.forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });
    
    const current = new Date(startDate);
    let addedDays = 0;
    const totalDays = 42;
    
    while (addedDays < totalDays) {
      const games = this.getGamesForDate(current);
      const isToday = this.isToday(current);
      const isCurrentMonth = this.isSameMonth(current);
      
      html += `
        <div class="calendar-day ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}" 
             onclick="window.calendar && window.calendar.onDateClick('${this.formatDate(current)}')">
          <div class="calendar-day-number">${current.getDate()}</div>
      `;
      
      const displayGames = games.slice(0, 3);
      displayGames.forEach(game => {
        const isHome = game.location && game.location.toLowerCase().includes('home');
        const hasConflict = game.has_conflict;
        const eventClass = hasConflict ? 'danger' : (isHome ? 'gold' : '');
        html += `
          <div class="calendar-event ${eventClass}" 
               onclick="event.stopPropagation(); window.calendar && window.calendar.onEventClick(${game.id})">
            ${game.start_time} ${game.team_name}
          </div>
        `;
      });
      
      if (games.length > 3) {
        html += `<div class="calendar-more" onclick="event.stopPropagation(); window.calendar && window.calendar.onDateClick('${this.formatDate(current)}')">+${games.length - 3} more</div>`;
      }
      
      html += '</div>';
      
      current.setDate(current.getDate() + 1);
      addedDays++;
    }
    
    html += '</div>';
    return html;
  }
  
  renderWeekView() {
    const startOfWeek = this.getWeekStart(this.currentDate);
    
    let html = '<div class="calendar-grid">';
    
    this.dayNames.forEach((day, index) => {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + index);
      const games = this.getGamesForDate(current);
      const isToday = this.isToday(current);
      
      html += `
        <div class="calendar-day ${isToday ? 'today' : ''}" 
             style="min-height: 200px;"
             onclick="window.calendar && window.calendar.onDateClick('${this.formatDate(current)}')">
          <div class="calendar-day-header" style="padding: 0.25rem;">${day}</div>
          <div class="calendar-day-number">${current.getDate()}</div>
      `;
      
      games.forEach(game => {
        const isHome = game.location && game.location.toLowerCase().includes('home');
        const hasConflict = game.has_conflict;
        const eventClass = hasConflict ? 'danger' : (isHome ? 'gold' : '');
        html += `
          <div class="calendar-event ${eventClass}" 
               onclick="event.stopPropagation(); window.calendar.onEventClick(${game.id})">
            ${game.start_time} - ${game.team_name}
          </div>
        `;
      });
      
      html += '</div>';
    });
    
    html += '</div>';
    return html;
  }
}

window.Calendar = Calendar;
