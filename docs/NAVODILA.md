# Kosmo — navodila za objavo

Aplikacija deluje na telefonu, tablici in računalniku. Kamera skenira v živo, deluje pa tudi z USB ali Bluetooth čitalnikom.

## 1. Skupna baza (Supabase, brezplačno), približno 10 minut

Brez tega koraka aplikacija deluje, a vsaka naprava hrani projekte zase.

1. Odpri **supabase.com** in ustvari račun.
2. **New project**: ime `kje-je-kos`, regija **Frankfurt (eu-central-1)**, izberi geslo baze in ga shrani.
3. Levo **SQL Editor** → **New query**: prilepi celotno vsebino datoteke `setup.sql` in klikni **Run**. Na enak način nato zaženi še `posodobitev-1.sql` in `posodobitev-2.sql` in `posodobitev-3.sql`.
4. Levo **Authentication** → **Users** → **Add user** → **Create new user**: vpiši e-naslov in geslo za delavnico ter obkljukaj **Auto Confirm User**. S tem računom se boste prijavljali na vseh napravah.
   Nato v **SQL Editorju** poveži račun z delavnico: na dnu `setup.sql` je razdelek **Nova delavnica**. Kopiraj tiste tri vrstice brez znakov `--`, vpiši ime delavnice in e-naslov ter klikni **Run**. Enako boš kasneje naredil za vsako novo stranko.
5. **Zakleni nove prijave** (pomembno): **Authentication** → **Sign In / Providers** → izklopi **Allow new users to sign up**. Tako si nihče ne more sam ustvariti računa in priti do vaših projektov.
6. Za račun na supabase.com vklopi dvostopenjsko preverjanje (**Account** → **Security** → **MFA**).
7. **Project Settings** → **API**: kopiraj **Project URL** in **anon public** ključ ter ju vpiši v `config.js` (ali ju pošlji Claudu).

Brezplačen Supabase projekt se po tednu dni brez uporabe zaustavi. V tem primeru se prijavi na supabase.com in klikni **Restore project**.

## 2. Objava na spletu (Netlify, brezplačno), približno 5 minut

1. Na računalniku odpri **app.netlify.com/drop**.
2. Povleci celotno mapo `kje-je-kos` v okno.
3. Dobiš naslov, npr. `https://ime.netlify.app`. Ustvari brezplačen račun, da objava ostane trajna, in v **Site configuration** spremeni ime, npr. `kje-je-kos-stajl`.
4. Ob vsaki posodobitvi aplikacije znova povleci mapo v **Deploys** istega projekta.

## 3. Namestitev na naprave

- **iPhone ali iPad**: odpri naslov v Safariju → **Deli** → **Dodaj na začetni zaslon**.
- **Android**: odpri v Chromu → meni ⋮ → **Namesti aplikacijo**.
- **Računalnik**: odpri v Chromu ali Edgu → ikona za namestitev v naslovni vrstici.

Ob prvem skeniranju aplikacija vpraša za dovoljenje za kamero. Dovoli ga.

## 4. Uvoz projektov

**Projekti** (ikona mape) → **Uvozi nov projekt**, nato izberi:
- `.zip` ali `.SAT` iz Mega Tischlerja: 3D model z vsemi ploščami,
- `.csv` kosovnico,
- `.json`: projekt, izvožen iz te aplikacije. V mapi `projekti` je že pripravljen `stanovanje-mama.kjejekos.json`, z otokom pred kuhinjo.

Projekt lahko z gumbom **Izvozi** shraniš kot datoteko in ga uvoziš drugje.

## Čitalnik črtnih kod

USB ali Bluetooth čitalnik deluje kot tipkovnica. Odpri aplikacijo in skeniraj, klikanje ni potrebno. Za QR kode na rdečih etiketah mora biti čitalnik **2D**.
