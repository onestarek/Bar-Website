require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const fs = require('node:fs');
const path = require('node:path')
const https = require('https');
const cors = require('cors');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const app = express();
const privateKey = fs.readFileSync(process.env.privateKey, 'utf8');
const certificate = fs.readFileSync(process.env.certificate, 'utf8');

const credentials = { key: privateKey, cert: certificate };

const webhook = new WebhookClient({url: process.env.WEBHOOK1})
const webhookkontakt = new WebhookClient({url: process.env.WEBHOOKKONTAKT})

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, 
        maxAge: 43200000
    }
}));

const mysql = require('mysql')

const db = mysql.createConnection({
    host: process.env.ip,
    user: process.env.user,
    password: process.env.pass,
    database: process.env.db
});
db.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
});
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));
app.use(express.json());
app.use(cors({    
    origin: process.env.ORIGIN
}));
const resetSessions = () => {
    app.use(async (req, res, next) => {
        try {
            await new Promise((resolve, reject) => {
                req.session.destroy(err => {
                    if (err) {
                        console.error("Error destroying session: ", err);
                        return reject(err);
                    }
                    console.log('Wylogowano ' + new Date())
                    resolve();
                });
            });

            await new Promise((resolve, reject) => {
                req.logout(err => {
                    if (err) {
                        console.error("Error logging out: ", err);
                        return reject(err);
                    }
                    console.log('Wylogowano ' + new Date())
                    resolve();
                });
            });

            res.redirect('/');
        } catch (err) {
            next(err);
        }
    });
};


const getTimeUntilNext12HourUTC = () => {
    const now = new Date();
    const currentHourUTC = now.getUTCHours();
    let nextTargetHour = 12;

    if (currentHourUTC >= 12) {
        nextTargetHour = 24;
    }

    const nextTargetTime = new Date(now);
    nextTargetTime.setUTCHours(nextTargetHour, 0, 0, 0);

    if (nextTargetTime <= now) {
        nextTargetTime.setUTCDate(nextTargetTime.getUTCDate() + 1);
    }

    return nextTargetTime - now;
};

const scheduleSessionReset = () => {
    const timeUntilNext12Hour = getTimeUntilNext12HourUTC();
    setTimeout(() => {
        resetSessions();
        setInterval(resetSessions, 12 * 60 * 60 * 1000);
    }, timeUntilNext12Hour);
};

async function updateRanking(discordID,kwota){
    const uid = discordID;
    const kwotazamowienia = kwota;

    db.query(`SELECT * FROM rankingpracownikow WHERE discordid = ?`, [uid], async (err, results) => {
        if (err) throw err;

        if (results.length === 0){
            db.query('SELECT * FROM pracownicy WHERE discordid = ?', [uid], async (err, results) => {
                if (err) throw err;
                db.query('INSERT INTO rankingpracownikow (discordid, imienazwisko, stopien, nickdiscord, ilosczamowien, lacznakwotazamowien) VALUES (?,?,?,?,?,?)',[uid, results[0].imienazwiskoic, results[0].stopien, results[0].nickdiscord,1,kwotazamowienia], (err) => {
                    if (err) throw err;
                })
            })
        } else {

            console.log(results[0])

            let ilosczamowien = results[0].ilosczamowien + 1;
            let lacznakwotazamowien = results[0].lacznakwotazamowien + kwotazamowienia;

            console.log(ilosczamowien, lacznakwotazamowien)

            db.query('UPDATE rankingpracownikow SET ilosczamowien = ?, lacznakwotazamowien = ? WHERE discordid = ?', [ilosczamowien,lacznakwotazamowien,uid], (err) => {
                if (err) throw err;
            });
        }
    })
}

scheduleSessionReset();
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), async (req, res) => {
    const uid = req.user.id;
    req.session.uid = uid;

    try {
        db.query('SELECT * FROM pracownicy WHERE discordid = ?', [uid], (err, results)=>{
            if (results.length > 0) {
                res.redirect('/portal');
            } else {
                res.redirect('/logout');
            }
        });
    } catch (error) {
        console.error('Błąd przy sprawdzaniu użytkownika:', error);
        res.redirect('/');
    }
});

app.get('/portal', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    res.sendFile(__dirname + '/pages/portal.html')
})
app.get('/leaderboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    res.sendFile(__dirname + '/pages/leaderboard.html')
})
app.post('/topka', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');

    try {
        const topOrdersQuery = `
            SELECT imienazwisko, stopien, nickdiscord, ilosczamowien
            FROM rankingpracownikow
            ORDER BY ilosczamowien DESC
            LIMIT 10
        `;

        const topRevenueQuery = `
            SELECT imienazwisko, stopien, nickdiscord, lacznakwotazamowien
            FROM rankingpracownikow
            ORDER BY lacznakwotazamowien DESC
            LIMIT 10
        `;

        const [topOrders, topRevenue] = await Promise.all([
            new Promise((resolve, reject) => {
                db.query(topOrdersQuery, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            }),
            new Promise((resolve, reject) => {
                db.query(topRevenueQuery, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            })
        ]);

        res.json({
            success: true,
            topOrders,
            topRevenue
        });
    } catch (error) {
        console.error("Błąd podczas pobierania danych:", error);
        res.status(500).json({ success: false, message: "Błąd serwera" });
    }
})
app.post('/wyslij', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    try {
        const { items, totalprice } = req.body;

        const uid = req.session.uid

        if (uid === undefined){
            return res.redirect('/auth/discord')
        }

        if (!items || !totalprice) {
            return res.status(400).json({ success: false, message: 'Brak wymaganych danych.' });
        }
        let {imienazwisko, stopien} = ''; 
        await new Promise((resolve, reject)=> {
            db.query('SELECT * FROM pracownicy WHERE discordid = ?', [uid], (err, results) => {
                if (err) {
                    reject()
                    throw err;
                }
                if(results.length > 0){
                    imienazwisko = results[0].imienazwiskoic;
                    stopien = results[0].stopien;
                    resolve();
                } else {
                    reject()
                    res.redirect('/auth/discord')
                }
            })
        })

        const embed = new EmbedBuilder()
        .setTitle('Nowe Zamówienie')
        .addFields([
            {name:"Kto wystawił", value:`${imienazwisko} (${uid}) - ${stopien}`},
            {name:"Zamówienie", value: `${items}`, inline:true},
            {name:"Kwota Zamówienia", value: `${totalprice}`, inline:true},
        ])
        .setColor('Orange')

        await webhook.send({
            embeds:[embed],
        });

        let price = totalprice.replace('$','')
        console.log(price + ' ' + totalprice)
        res.json({ success: true });
        await updateRanking(uid, parseInt(price));
    } catch (error) {
        console.error('Błąd przy wysyłaniu wiadomości na Discord:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
});

app.post('/formularz', async (req, res) => {
    try {
        const { daneformularza } = req.body;
        const { fullName, phoneNumber, reason, description } = daneformularza;

        const embed = new EmbedBuilder()
            .setTitle('Nowe Zgłoszenie')
            .addFields([
                { name: "Imię i nazwisko", value: fullName, inline: true },
                { name: "Numer telefonu", value: phoneNumber, inline: true },
                { name: "Powód kontaktu", value: reason },
                { name: "Opis", value: description },
            ])
            .setColor('Orange');

        await webhookkontakt.send({
            embeds: [embed],
        });

        res.status(200).json({ success: true, message: 'Zgłoszenie zostało przesłane!' });

    } catch (error) {
        console.error('Błąd przy wysyłaniu wiadomości na Discord:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pages/index.html');
});

app.use((req, res, next) => {
    res.status(404).send("Sorry, can't find that!");
});
const httpsServer = https.createServer(credentials, app);
httpsServer.listen(5000, () => {
    console.log('Serwer uruchomiony na porcie 5000.');
});