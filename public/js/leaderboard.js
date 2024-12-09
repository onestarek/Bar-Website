function scheduleRedirect() {
    const now = new Date();
    const redirectTimes = [
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0),
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 59, 0)
    ];

    const nextRedirect = redirectTimes.find(time => time > now) || new Date(redirectTimes[0].getTime() + 24 * 60 * 60 * 1000);

    localStorage.setItem('redirectTime', nextRedirect);

    const timeUntilRedirect = nextRedirect - now;

    setTimeout(() => {
        window.location.href = '/logout';
    }, timeUntilRedirect);
}
function startLogoutTimer() {
    const timerElement = document.getElementById('logout-timer');

    function updateTimer() {
        const redirectTime = localStorage.getItem('redirectTime');
        if (!redirectTime) {
            timerElement.textContent = 'Brak zaplanowanego wylogowania';
            return;
        }

        const now = new Date();
        const targetTime = new Date(redirectTime);
        const timeRemaining = targetTime - now;

        if (timeRemaining <= 0) {
            timerElement.textContent = 'Wylogowanie w toku...';
            clearInterval(timerInterval);
            return;
        }

        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

        timerElement.textContent = `Pozostały czas do wylogowania: ${hours}h ${minutes}m`;
    }

    const timerInterval = setInterval(updateTimer, 60000);
    updateTimer();
}

function checkRedirect() {
    const redirectTime = localStorage.getItem('redirectTime');
    if (redirectTime) {
        const now = new Date();
        const targetTime = new Date(redirectTime);

        if (targetTime > now) {
            const timeUntilRedirect = targetTime - now;

            setTimeout(() => {
                window.location.href = '/logout';
            }, timeUntilRedirect);
            
        } else {
            localStorage.removeItem('redirectTime');
            scheduleRedirect();
        }
    } else {
        scheduleRedirect();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    async function fetchLeaderboardData() {
        try {
            const response = await fetch('/topka', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (data.success) {
                populateLeaderboard(data.topOrders, "left-panel", "Top wg ilości zamówień");
                populateLeaderboard(data.topRevenue, "right-panel", "Top wg kwoty zamówień");
            } else {
                console.error("Błąd w odpowiedzi serwera:", data.message);
            }
        } catch (error) {
            console.error("Błąd podczas pobierania danych:", error);
        }
    }

    function populateLeaderboard(list, panelClass, title) {
        const panel = document.querySelector(`.${panelClass}`);
        panel.innerHTML = `<h2>${title}</h2><ol class="leaderboard-list"></ol>`;
        
        const listElement = panel.querySelector(".leaderboard-list");
        
        if (list.length === 0) {
            listElement.innerHTML = "<p>Brak danych do wyświetlenia.</p>";
            return;
        }

        list.forEach((item, index) => {
            const listItem = document.createElement("li");
            const details = `
                <span class="place">${index + 1}.</span> 
                <span class="name">${item.imienazwisko || "Nieznany"}</span> 
                <span class="rank">${panelClass === "left-panel" ? `Zamówienia: ${item.ilosczamowien}` : `Kwota: ${item.lacznakwotazamowien}$`}</span>
                <span class="position">(${item.stopien || "Brak stopnia"})</span>
            `;
            listItem.innerHTML = details;
            listElement.appendChild(listItem);
        });
    }
    
    fetchLeaderboardData();
    checkRedirect();
    startLogoutTimer();
});
