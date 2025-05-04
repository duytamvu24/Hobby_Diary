const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyDiaryApp", 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('posts')) {
                db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('hobbyColors')) {
                db.createObjectStore('hobbyColors');
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);  // Rückgabe der DB bei Erfolg
        request.onerror = (event) => reject(event.target.error);      // Fehlerbehandlung
    });
};

const getAllPostsFromDB = async () => {
    const db = await openDB();  // Warten auf das Öffnen der DB
    if (!db) {
        console.error("Datenbank konnte nicht geöffnet werden");
        return [];
    }

    const tx = db.transaction('posts', 'readonly');  // 'readonly' für Lesezugriff
    const store = tx.objectStore('posts');
    
    return new Promise((resolve, reject) => {
        const request = store.getAll();  // Holt alle Posts

        request.onsuccess = () => {
            resolve(request.result);  // Gib das Ergebnis der Anfrage zurück
        };

        request.onerror = (event) => {
            reject('Fehler beim Abrufen der Posts: ' + event.target.error);  // Fehlerbehandlung
        };
    });
};

async function open_post(index){
    change_view("opened_post");

    if(document.getElementById("post_image_in_post")) {
        document.getElementById("post_image_in_post").remove();
        console.log("bild wurde entfernt");
    }

    const savedPosts = await getAllPostsFromDB();
    const post = savedPosts[index];
    const title = opened_post.querySelector('.opened_post_title');
    title.textContent = post.title;
    title.style.fontSize  = "30px";
    const hobby = opened_post.querySelector('.opened_post_hobby');
    hobby.textContent = post.hobby;
    const date = opened_post.querySelector('.opened_post_date');
    date.textContent = post.date;
    const text = opened_post.querySelector('.opened_post_text');
    text.textContent = post.note;
    text.style.fontSize  = "25px";
    const info = opened_post.querySelector('.opened_post_info');
    info.textContent = post.tag;
    if(post.image){
        const image_div = document.createElement("div");
        image_div.style.backgroundImage = `url(${post.image})`; // Hintergrundbild setzen
        // Hier könntest du auch weitere Stile hinzufügen, um das Div anzupassen
        image_div.style.width = "100%"; 
        image_div.style.paddingBottom = "56.25%";
        image_div.style.backgroundSize = "contain";
        image_div.style.backgroundRepeat = "no-repeat";
        image_div.id = "post_image_in_post";
        image_div.style.marginBottom = "15px";
        // Füge das image_div zum Post-Body hinzu
        const post_body = document.getElementById("post_body");
        post_body.insertBefore(image_div, text);
    }
    

    // Edit Button ersetzen
    const oldEditBtn = document.getElementById("edit_post");
    const newEditBtn = oldEditBtn.cloneNode(true);
    oldEditBtn.replaceWith(newEditBtn);
    newEditBtn.addEventListener('click', () => edit_post(index));

    // Delete-Button ersetzen
    const oldDeleteBtn = document.getElementById("delete_post");
    const newDeleteBtn = oldDeleteBtn.cloneNode(true);
    oldDeleteBtn.replaceWith(newDeleteBtn);
    newDeleteBtn.addEventListener('click', () => delete_post(index));
}

async function create_new_post(index = null) {
    console.log(index);
    const title = document.getElementById('title').value;
    const date = document.getElementById('date').value;
    const hobby = document.getElementById('category').value.trim().toLowerCase();
    const tag = document.getElementById('tag').value;
    const entry = document.getElementById('entry').value;
    const imageInput = document.getElementById('image');
    const imageFile = imageInput.files[0];
    const color = document.getElementById("color").value;

    const db = await openDB();

    // Hobbyfarbe speichern
    const colorTx = db.transaction('hobbyColors', 'readwrite');
    const colorStore = colorTx.objectStore('hobbyColors');
    await colorStore.put(color, hobby);
    await colorTx.complete;

    const savePost = async (imageDataUrl = null) => {
        const posts = await getAllPostsFromDB(); // <-- Erst ALLE Posts holen
        const oldPost = posts[index];
    
        if (index != null && oldPost) {
            const post = new Post(title, date, hobby, tag, entry, imageDataUrl, null, color);
    
            const tx = db.transaction('posts', 'readwrite'); // <-- Dann Transaction starten
            const store = tx.objectStore('posts');
    
            // Key holen
            const key = await new Promise((resolve, reject) => {
                console.log(oldPost);
                const keyRequest = store.getKey(oldPost.id);
                keyRequest.onsuccess = () => resolve(keyRequest.result);
                keyRequest.onerror = () => reject(keyRequest.error);
            });
    
            // neuen Post speichern
            await new Promise((resolve, reject) => {
                const updateRequest = store.put({ ...post, id: key });
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            });
    
            console.log('Eintrag wurde erfolgreich ersetzt.');
        } else {
            const post = new Post(title, date, hobby, tag, entry, imageDataUrl, null, color);

            // Transaction starten für neuen Post
            const tx = db.transaction('posts', 'readwrite'); 
            const store = tx.objectStore('posts');

            // Neuen Post erstellen
            await new Promise((resolve, reject) => {
                const addRequest = store.add(post);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });

            console.log('Post erstellt!');
        }
    };

    if (imageFile) {
        const reader = new FileReader();
        reader.onload = async function () {
            const imageDataUrl = reader.result;
            await savePost(imageDataUrl);
            afterSave();
        };
        reader.readAsDataURL(imageFile);
    } else {
        await savePost();
        afterSave();
    }

    function afterSave() {
        load_posts_on_start();
        document.getElementById("createView").style.display = "none";
        document.getElementById("app").style.display = "block";
        get_unique_hobbies();
        filter_by_selection();
        fillDays();
    }
}


function load_posts_on_start() {
    const getPost = async (index) => {
        const db = await openDB();
        const tx = db.transaction('posts', 'readonly'); // 'readonly', da wir nur Daten abrufen
        const store = tx.objectStore('posts');
        
        const post = await store.get(index); // Abrufen des Posts mit dem angegebenen index
        await tx.complete; // Warten auf das Ende der Transaktion
        console.log('Gefundener Post:', post);
        return post;
    };
}


localStorage.clear();
//laden Der Posts beim Start!
load_posts_on_start();

function change_create_post(){
    change_view("createView");

    // Textfelder mit alten Daten befüllen
    document.getElementById("title").placeholder = "Title";
    document.getElementById("title").value = "";
    document.getElementById("category").placeholder = "Hobby";
    document.getElementById("category").value = "";
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("date").value = today;
    document.getElementById("entry").placeholder = "Schreibe deinen Eintrag";
    document.getElementById("entry").value = "";
    document.getElementById("tag").placeholder = "Tag";
    document.getElementById("tag").value = "";
    document.getElementById('image').value = '';
    document.getElementById("save").onclick = () => create_new_post();
    

}

function post_back(){
    change_view("app");
}

async function delete_post(index){
    const delete_confirmation = document.createElement("div");
    const delete_question = document.createElement("div");
    const yes_div = document.createElement("div");
    const no_div = document.createElement("div");

    delete_question.textContent = "Willst du den Post wirklich löschen?";
    yes_div.textContent = "Ja";
    no_div.textContent = "Nein";
    yes_div.addEventListener('click', async() => {
        
        const db = await openDB(); // Öffne die IndexedDB
        const tx = db.transaction('posts', 'readwrite'); // Transaktion im 'readwrite' Modus
        const store = tx.objectStore('posts');

        // Alle Posts abrufen
        const posts = await new Promise((resolve, reject) => {
            const request = store.getAll(); // Alle Posts abrufen
            request.onsuccess = () => resolve(request.result); // Erfolgsfall: Alle Posts zurückgeben
            request.onerror = () => reject('Fehler beim Abrufen der Posts'); // Fehlerfall
        });

        // Schritt 2: Entferne den Post mit dem gegebenen Index
        if (posts.length > index) {
            posts.splice(index, 1); // Entferne den Post aus dem Array
        }

        // Schritt 3: Speichere die neue Liste wieder in der IndexedDB
        // Lösche alle Posts und füge die neue Liste wieder hinzu
        const clearRequest = store.clear(); // Lösche alle Posts im Store
        clearRequest.onsuccess = () => {
            posts.forEach(post => {
                store.add(post); // Füge alle verbleibenden Posts wieder hinzu
            });

            console.log('Post wurde erfolgreich gelöscht und die Liste aktualisiert.');
        };
        clearRequest.onerror = (e) => {
            console.error('Fehler beim Löschen der Posts:', e);
        };

        // Bestätigungsnachricht entfernen
        delete_confirmation.remove();
        change_view("app");
        filter_by_selection();
    });
    no_div.addEventListener('click', () => {
        // Bestätigungsnachricht entfernen
        delete_confirmation.remove();
    });
    delete_confirmation.appendChild(delete_question);
    delete_confirmation.appendChild(yes_div);
    delete_confirmation.appendChild(no_div);

    document.body.appendChild(delete_confirmation);

    delete_confirmation.style.display = "grid";
    delete_confirmation.style.gridTemplateColumns = "auto auto";
}

async function edit_post(index){
    change_view("createView");

    const savedPosts = await getAllPostsFromDB();
    const post = savedPosts[index];


    // Textfelder mit alten Daten befüllen
    document.getElementById("title").value = post.title;
    document.getElementById("category").value = post.hobby;
    document.getElementById("date").value = post.date;
    document.getElementById("entry").value = post.note;
    document.getElementById("tag").value = post.tag;

    const saveButton = document.getElementById("save");

    // Entferne alte EventListener (indem wir onclick verwenden – einfach & sicher)
    saveButton.onclick = () => create_new_post(index);
    get_unique_hobbies();
    filter_by_selection();
}


async function get_unique_hobbies() {
    const allPosts = await getAllPostsFromDB();
    const allHobbies = allPosts.map(post => post.hobby);
    const uniqueHobbies = [...new Set(allHobbies)];
    console.log(uniqueHobbies);

    const dropdown = document.getElementById("hobbyDropdown");
    dropdown.innerHTML = ""; // 🔥 alle alten Optionen entfernen

    // Standardoption wieder hinzufügen
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Hobby";
    dropdown.appendChild(defaultOption);

    // Neue Optionen hinzufügen
    uniqueHobbies.forEach(hobby => {
        const option = document.createElement("option");
        option.value = hobby;
        option.textContent = hobby;
        dropdown.appendChild(option);
    });

    // Auswahl zurücksetzen
    dropdown.value = "";
}



get_unique_hobbies();

async function filter_by_selection(e = null) {
    const dropdown = document.getElementById("hobbyDropdown");
    dropdown.addEventListener("change", filter_by_selection);
    const selectedHobby = e ? e.target.value : dropdown.value;

    const allPosts = await getAllPostsFromDB();
    console.log('Alle Posts:', allPosts);
    let filteredPosts;

    if (selectedHobby === "") {
        // Wenn keine Auswahl getroffen wurde, zeige alle Posts
        filteredPosts = allPosts;
    } else {
        // Filtere nur Posts mit dem gewählten Hobby
        filteredPosts = allPosts.filter(post => post.hobby === selectedHobby);
    }

    //filter auf Tage
    const isChecked = document.getElementById('box_show_only_date').checked;
    if(isChecked) {
        const days = document.querySelectorAll('.day');
        const centralText = days[3].querySelectorAll('div')[0].textContent;
        if(centralText === "Tag"){return}
        const [tagMonat, _] = centralText.split(' ');
        const [dayStr, monthStr] = tagMonat.split('.');
        console.log(centralText);
        const day = parseInt(dayStr);
        const monthName = monthStr.trim();
        console.log(day, monthName);
        const months = {
            "Januar": 0,
            "Februar": 1,
            "März": 2,
            "April": 3,
            "Mai": 4,
            "Juni": 5,
            "Juli": 6,
            "August": 7,
            "September": 8,
            "Oktober": 9,
            "November": 10,
            "Dezember": 11
        };

        const month = months[monthName];

        // Erzeuge ein Datum im Format YYYY-MM-DD
        const now = new Date();
        const year = now.getFullYear(); // Falls du das Jahr auch brauchst

        const filteredDate = new Date(year, month, day).toISOString().split("T")[0];
        console.log('filter by date', filteredDate);
        filteredPosts = filteredPosts.filter(post => post.date === filteredDate);
    }

    const post_overview = document.querySelector('.posts');
    const childDivs = post_overview.querySelectorAll('div');
    childDivs.forEach(div => div.remove());

    filteredPosts.forEach((post) => {
        let post_entry = document.createElement("div");
        post_entry.style.backgroundColor = post.color;
        post_entry.style.display = "grid";
        post_entry.style.gridTemplateColumns = "1fr 1fr";
        let post_title = document.createElement("div");
        let post_hobby = document.createElement("div");
        let post_index = post.id -1;
        console.log(post_index);
        //let post_index = post.index;
        //console.log(post_index);
        post_title.textContent = post.title;
        post_title.style.fontSize = "20px";
        post_title.style.fontStyle = "bold";
        post_title.style.marginBottom = "10px";
        post_title.style.fontWeight = "bold"
        post_hobby.textContent = post.hobby;
        post_hobby.style.marginBottom = "10px";
        let post_text_preview = document.createElement("div");
        post_text_preview.appendChild(post_title);
        post_text_preview.appendChild(post_hobby);
        post_entry.appendChild(post_text_preview);
        post_entry.id = "post_id_" + post_index;
        post_entry.dataset.index = post_index;
        post_entry.classList.add("post");
        post_entry.style.borderRadius = "20px";
        post_entry.style.pointerEvents = 'pointer';
        post_entry.style.padding = "10px 5px 10px 5px"
        console.log(post_index);
        post_entry.addEventListener('click', () => open_post(post_index));

        // falls es ein Bild gibt zeige es
        if(post.image){
            const image_div = document.createElement("div");
            console.log("bild hier");
            image_div.style.backgroundImage = `url(${post.image})`; // Hintergrundbild setzen
            // Hier könntest du auch weitere Stile hinzufügen, um das Div anzupassen
            image_div.style.width = "100%";
            image_div.style.height = "100px"
            image_div.style.backgroundSize = "contain";
            image_div.style.backgroundRepeat = "no-repeat";
            image_div.id = "post_image";
            image_div.style.marginBottom = "15px";
            post_entry.appendChild(image_div);
        }

        post_overview.appendChild(post_entry);
        console.log('Post wurde zum Feed hinzugefügt');
    });
        
        // Hier könntest du ein <div> für jeden Eintrag erstellen und in das HTML einfügen

}

const checkbox = document.getElementById("box_show_only_date");
checkbox.addEventListener("change", function() {
    filter_by_selection();
});

function tageImMonat(monat, jahr) {
    return new Date(jahr, monat + 1, 0).getDate();
}

const month_names = {
    0: "Jan",
    1: "Feb",
    2: "Mär",
    3: "Apr",
    4: "Mai",
    5: "Jun",
    6: "Jul",
    7: "Aug",
    8: "Sep",
    9: "Okt",
    10: "Nov",
    11: "Dez"
}

async function show_calender_ovewview(heute = new Date()){
    document.getElementById("createView").style.display = "none";
    document.getElementById("app").style.display = "none";
    document.getElementById("opened_post").style.display = 'none';
    document.getElementById("settings_view").style.display = "none";
    document.getElementById("statistics").style.display = "none";
    if(document.getElementById("calender_view")){
        document.getElementById("calender_view").remove();
        document.getElementById("calender_head").remove();
    }

    const aktuellerMonat = heute.getMonth(); // Monat (0 = Januar, 1 = Februar, ..., 11 = Dezember)
    const aktuellesJahr = heute.getFullYear(); // Jahr

    let ersterTagImMonat = new Date(aktuellesJahr, aktuellerMonat, 1); // 1. Tag des Monats, beginnend mit Montag
    ersterTagImMonat = ersterTagImMonat.getDay() - 1;
    const anzahlTage = tageImMonat(aktuellerMonat, aktuellesJahr); // Beispiel: 30 Tage

    const calender_head = document.createElement("div");
    calender_head.id = "calender_head";
    calender_head.style.display="grid";
    calender_head.style.gridTemplateColumns = "1fr 1fr 1fr";
    const left_arrow = document.createElement("div");
    const right_arrow = document.createElement("div");
    left_arrow.textContent = "<";
    right_arrow.textContent = ">";
    left_arrow.addEventListener("click", () => {
        const previousMonth = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
        show_calender_ovewview(previousMonth);
    });
    right_arrow.addEventListener("click", () => {
        const previousMonth = new Date(heute.getFullYear(), heute.getMonth() + 1, 1);
        show_calender_ovewview(previousMonth);
    });
    calender_head.appendChild(left_arrow);


    const month_name = month_names[aktuellerMonat];
    console.log(month_name);
    const month_year = document.createElement("div");
    month_year.textContent = `${month_name} ${aktuellesJahr}`;
    calender_head.appendChild(month_year);
    calender_head.appendChild(right_arrow);
    calender_head.style.marginLeft = "3px";
    calender_head.style.marginRight = "3px";
    calender_head.style.marginTop = "5px";
    calender_head.style.marginBottom = "5px";
    document.body.appendChild(calender_head);

    const calender = document.createElement("div");
    calender.id = "calender_view";
    calender.style.display = "grid"; // Korrektur: display gehört zu style, nicht calender direkt
    calender.style.gridTemplateColumns = "repeat(7, 1fr)"; // 7 Spalten (Mo-So)
    calender.style.gap = "2px"; // Abstand zwischen den Tagen
    calender.style.margin = "5px 5px 5px 5px";
    document.body.appendChild(calender);

    const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    for(const day of days){
        	const day_name = document.createElement("div");
            day_name.textContent = day;
            day_name.style.textAlign = "center"; // Text zentrieren
            day_name.style.fontWeight = "bold"; 
            calender.appendChild(day_name);
    }

    for (let i = 0; i < ersterTagImMonat; i++){
        const empty_div = document.createElement("div");
        calender.appendChild(empty_div);
    }

    const today_today = new Date();

    for (let tag = 1; tag <= anzahlTage; tag++) {
        const tagDiv = document.createElement("div");
        tagDiv.style.border = "1px solid #ccc";
        //aktuellerMonat
        //tag
        //aktullesJahr
        const event_day = new Date(aktuellesJahr, aktuellerMonat, tag);
        if(
            today_today.getDate() === event_day.getDate() &&
            today_today.getMonth() === event_day.getMonth() &&
            today_today.getFullYear() === event_day.getFullYear() 
        ){
            tagDiv.style.borderStyle = "solid";
            tagDiv.style.borderColor = "blue";
            tagDiv.style.borderWidth = "4px";
            console.log("today");
        }
        tagDiv.addEventListener("click", () =>{
            document.getElementById("createView").style.display = "none";
            document.getElementById("app").style.display = "block";
            document.getElementById("opened_post").style.display = 'none';
            document.getElementById("settings_view").style.display = "none";
            document.getElementById("calender_view").remove();
            document.getElementById("calender_head").remove();
            fillDays(event_day);
        });
        tagDiv.style.display = "flex";
        tagDiv.style.flexDirection = "column";
        tagDiv.style.backgroundColor = "white";
        const tag_content = document.createElement("div");
        tag_content.textContent = tag;
        tagDiv.appendChild(tag_content);
        tagDiv.id = `${tag}_${aktuellerMonat}_${aktuellesJahr}`;
        tagDiv.style.height = "80px";
        tagDiv.style.flex = "1"; // Tippfehler: "widows" -> richtig "width"
        tagDiv.style.alignItems = "center"; 
        tagDiv.style.justifyContent = "center"; 
        calender.appendChild(tagDiv);

    }

    const existingPosts = await getAllPostsFromDB();
    
    for (let post of existingPosts){
        const datum = new Date(post.date);
        console.log(datum);
        const post_day = datum.getDate();
        const post_month = datum.getMonth();
        const post_year = datum.getFullYear();
        if (
            post_month === aktuellerMonat &&
            post_year === aktuellesJahr
        ) {
            const post_entry = document.getElementById(`${post_day}_${post_month}_${post_year}`);
            const new_hobby = document.createElement("div");
            new_hobby.style.borderStyle = "solid";
            new_hobby.style.borderWidth = "1px";
            new_hobby.style.borderColor = "black";
            new_hobby.style.flex = "1";
            new_hobby.style.width = "90%";
            new_hobby.style.flex = "1";
            new_hobby.style.backgroundColor = post.color;
            post_entry.appendChild(new_hobby);


        }
    }
}


filter_by_selection();

async function fillDays(centerDate = null) {
    const daysDivs = document.querySelectorAll('.day');
    const baseDate = centerDate ? new Date(centerDate) : new Date();

    // Verstecke alle Tage sanft
    daysDivs.forEach(div => div.style.opacity = '0');

    const existingPosts = await getAllPostsFromDB();

    setTimeout(() => {
        
        for (let index = 0; index < daysDivs.length; index++) {
            const dayDiv = daysDivs[index];
            const tagDiv = dayDiv.querySelectorAll('div')[0];
            const zahlDiv = dayDiv.querySelectorAll('div')[1];

            const offset = index - 2;
            const currentDate = new Date(baseDate); // Neues Datum basierend auf center
            currentDate.setDate(baseDate.getDate() + offset);

            const day = currentDate.getDate();
            const month = currentDate.toLocaleString('de-DE', { month: 'long' });
            const month_int = currentDate.getMonth();
            const year_int = currentDate.getFullYear();
            const weekday = currentDate.toLocaleString('de-DE', { weekday: 'short' });

            tagDiv.textContent = `${day}.${month} ${weekday}`;
            tagDiv.style.fontSize = "12px";
            //Einträge für jeden fill days tag

            zahlDiv.style.display = "flex";
            zahlDiv.style.flexDirection = "row";

            zahlDiv.innerHTML = ""; // alte Einträge entfernen           
    
            for (let post of existingPosts){
                const datum = new Date(post.date);
                const post_day = datum.getDate();
                const post_month = datum.getMonth();
                const post_year = datum.getFullYear();
                if (
                    post_day === day &&
                    post_month === month_int &&
                    post_year === year_int
                ) {
                    const new_hobby = document.createElement("div");
                    new_hobby.style.backgroundColor = post.color;
                    new_hobby.style.height = "10px";
                    new_hobby.style.flex = "1";
                    new_hobby.id = "fill_days_posts";
                    zahlDiv.appendChild(new_hobby);
                    console.log(datum);
                    console.log("hier ist was");
                }
            }


            // Reset Styles
            dayDiv.style.backgroundColor = '';
            dayDiv.style.fontWeight = '';

            // Highlight zentrales Div
            if (index === 2) {
                dayDiv.style.backgroundColor = '#f0f0f0';
                dayDiv.style.fontWeight = 'bold';
            }

            // OnClick zum Verschieben des Zentrums
            dayDiv.onclick = () => fillDays(currentDate);

            // Sanftes Einblenden
            setTimeout(() => {
                dayDiv.style.opacity = '1';
                dayDiv.style.transition = 'opacity 0.3s ease';
            }, 10);
        };
        filter_by_selection();
    }, 150); // Wartezeit für den Opacity-Übergang
}


fillDays(); // Aufruf der Funktion ohne übergebenes Datum, um das heutige Datum zu verwenden

async function change_view(div_block){
    document.getElementById("createView").style.display = "none";
    document.getElementById("app").style.display = "none";
    document.getElementById("opened_post").style.display = 'none';
    document.getElementById("settings_view").style.display = "none";
    document.getElementById("statistics").style.display = "none";
    if(document.getElementById("calender_view")){
        document.getElementById("calender_view").remove();
        document.getElementById("calender_head").remove();
    }

    //Öffne den richtigen Div
    const to_open = document.getElementById(div_block);
    to_open.style.display = "block";
}



async function show_settings_view() {
    change_view("settings_view");
}

let pie_chart = null;
let bar_chart = null;

async function open_statistics() {
    
    if(pie_chart){
        pie_chart.destroy();
    }

    change_view("statistics");
    //const db = await getAllPostsFromDB();
    const hobby_count = await count_posts_per_hobby();
    const posts_month = await posts_per_month();
    const pie_ctx = document.getElementById('hobbyChart').getContext('2d');
    const pie_labels = Object.keys(hobby_count);
    const pie_data = Object.values(hobby_count);
    const db = await getAllPostsFromDB();
    const uniqueHobbies = [...new Set(db.map(post => post.hobby))];
    // ermittlet farbe
    let color_lists = [];
    const bal_ctx = document.getElementById("month_Chart").getContext('2d');
    const balk_labels = Object.keys(posts_month);
    let balk_dict = {}
    balk_dict["labels"] = balk_labels;
    balk_dict["datasets"] = [];
    for (let hobby of uniqueHobbies){
        try {
            // Öffne die DB
            const color_db = await openDB(); // Stelle sicher, dass openDB() funktioniert (entsprechende Funktion implementiert)
    
            // Transaction starten
            const colorTx = color_db.transaction('hobbyColors', 'readonly');
            const colorStore = colorTx.objectStore('hobbyColors');
    
            // Hole die Farbe aus der DB
            const color = await new Promise((resolve, reject) => {
                const request = colorStore.get(hobby);  // Hole die Farbe für das Hobby
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject('Fehler beim Abrufen der Farbe');
            });
            //console.log(hobby, color);
            color_lists.push(color);
        } catch (error) {
            console.error("Fehler beim Abrufen der Farbe:", error);
            colorInput.value = ""; // Setze Farbe zurück, wenn Fehler auftritt
        }
    }
    if(bar_chart){
        bar_chart.destroy();
    }
    
    
    pie_chart = new Chart(pie_ctx, {
        type: 'pie',
        data: {
            labels: pie_labels,
            datasets: [{
                label: 'Anzahl Posts',
                data: pie_data,
                backgroundColor: color_lists,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
    console.log(posts_month);
    for(let hobby of uniqueHobbies){
        let hobby_dict = {label: hobby};
        let counts = [];
        try {
            // Öffne die DB
            const color_db = await openDB(); // Stelle sicher, dass openDB() funktioniert (entsprechende Funktion implementiert)
    
            // Transaction starten
            const colorTx = color_db.transaction('hobbyColors', 'readonly');
            const colorStore = colorTx.objectStore('hobbyColors');
    
            // Hole die Farbe aus der DB
            const color = await new Promise((resolve, reject) => {
                const request = colorStore.get(hobby);  // Hole die Farbe für das Hobby
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject('Fehler beim Abrufen der Farbe');
            });
            //console.log(hobby, color);
            hobby_dict["backgroundColor"] = color;
        } catch (error) {
            console.error("Fehler beim Abrufen der Farbe:", error);
        }
        for (let key in posts_month) {
            const posts = posts_month[key];
            if (posts.length === 0) {
                counts.push(0);
                continue;
            }
            const count = posts.filter(post => post.hobby === hobby).length;
            counts.push(count);
        }
        hobby_dict["data"] = counts;
        balk_dict["datasets"].push(hobby_dict);
    }
    console.log(balk_dict);
    


    bar_chart = new Chart(bal_ctx, {
        type: 'bar',
        data: balk_dict,
        options: {
          responsive: true,
          scales: {
            x: {
              stacked: true
            },
            y: {
              stacked: true,
              beginAtZero: true
            }
          }
        }
      });
}

async function posts_per_month(year = (new Date().getFullYear())) {
    console.log(year);
    const db = await getAllPostsFromDB();
    //Zählt Hobbies für jeden Monat
    const hobbies_per_month = {};

    for (let i = 0; i <= 11; i++) {
        const monthIndex = i;
        const monthName = new Date(year, monthIndex).toLocaleString('de-DE', { month: 'long' });
        console.log(monthName);
        hobbies_per_month[monthName] = []; // oder z. B. 0, [] oder "" als Startwert
    }
    console.log(hobbies_per_month);
    for (let post of db){
        let date = post.date;
        date = new Date(date);
        let month = date.getMonth();
        let year_post = date.getFullYear();
        const monthName = new Date(year_post, month).toLocaleString('de-DE', { month: 'long' });
        if(year === year_post){
            hobbies_per_month[monthName].push(post);
        }
    }
    console.log(hobbies_per_month);
    return hobbies_per_month;
    //console.log(hobbies_per_month);
}

async function count_posts_per_hobby() {
    //Zählt Anzahl Posts für jedes Hobby
    const db = await getAllPostsFromDB();
    let count_hobbies = {};
    for (let post of db){
        if(post.hobby in count_hobbies){
            let hobby = post.hobby;
            count_hobbies[hobby] = count_hobbies[hobby] + 1;
        }
        else {
            count_hobbies[post.hobby] = 1;
        }
    }
    console.log(count_hobbies);
    return count_hobbies;
}

document.getElementById("calenderView").addEventListener("click", () => {
    change_view("app");
});


document.getElementById("show_statistics").addEventListener("click", () => {
    open_statistics();
});

document.getElementById("calendarIcon").addEventListener("click", () => {
    show_calender_ovewview();
});

document.getElementById("settings").addEventListener("click", () => {
    show_settings_view();
})

document.getElementById("calendarIcon2").addEventListener("click", () => {
    show_calender_ovewview();
});

// Wenn ein Datum gewählt wird → mit fillDays() aktualisieren
document.getElementById("calendarPicker").addEventListener("change", (e) => {
    //const selectedDate = e.target.value;
    //console.log("Gewähltes Datum:", selectedDate);

    // fillDays mit gewähltem Datum aufrufen
    fillDays(selectedDate);
});

document.getElementById("settings_back").addEventListener("click", () =>{
    change_view("app");
});

document.getElementById("category").addEventListener("input", async () => {
    const hobby = document.getElementById("category").value.trim().toLowerCase();
    const colorInput = document.getElementById("color");

    try {
        // Öffne die DB
        const db = await openDB(); // Stelle sicher, dass openDB() funktioniert (entsprechende Funktion implementiert)

        // Transaction starten
        const colorTx = db.transaction('hobbyColors', 'readonly');
        const colorStore = colorTx.objectStore('hobbyColors');

        // Hole die Farbe aus der DB
        const color = await new Promise((resolve, reject) => {
            const request = colorStore.get(hobby);  // Hole die Farbe für das Hobby
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('Fehler beim Abrufen der Farbe');
        });

        // Wenn eine Farbe gefunden wurde, setze sie im colorInput
        if (color) {
            colorInput.value = color; // Setze bekannte Farbe
        } else {
            colorInput.value = ""; // Setze Farbe zurück, wenn Hobby nicht gefunden wird
        }
    } catch (error) {
        console.error("Fehler beim Abrufen der Farbe:", error);
        colorInput.value = ""; // Setze Farbe zurück, wenn Fehler auftritt
    }
});

function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
  
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

async function ask_save_backup(){
    console.log("Willst du deine Daten als Download speichern?");
    const save_question = document.createElement("div");
    const yes_div = document.createElement("div");
    const no_div = document.createElement("div");

    save_question.textContent = "Willst du deine Daten als Donwload speichern?";
    yes_div.textContent = "Ja";
    no_div.textContent = "Nein";
    yes_div.addEventListener('click', async() => {
        const db = await openDB(); // Öffne die IndexedDB
        console.log("speichern");

        const posts = await getAllFromStore(db, 'posts');
        const hobbyColors = await getAllFromStore(db, 'hobbyColors');

        const data = {
            posts,
            hobbyColors
        };

        const jsonString = JSON.stringify(data, null, 2); // schön formatiert
        const blob = new Blob([jsonString], { type: "application/json" });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "backup.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        save_question.remove();
    });
    no_div.addEventListener('click', () => {
        // Bestätigungsnachricht entfernen
        save_question.remove();
    });
    const save_backup_div = document.getElementById("settings_view");
    save_question.appendChild(yes_div);
    save_question.appendChild(no_div);
    save_backup_div.appendChild(save_question);
}

document.getElementById("save_backup").addEventListener("click", ask_save_backup);

document.getElementById("hobbyDropdown").addEventListener("change", filter_by_selection);

document.getElementById("opened_post_back_button").addEventListener('click', post_back);

document.getElementById("bottom_add").addEventListener('click', change_create_post);

document.getElementById("post_go_back").addEventListener('click', post_back);
document.getElementById("change_background_color").addEventListener("click", () => {
    // Container für Farbauswahl
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "10000";

    // Farbwähler
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = "#ffffff";
    colorPicker.style.marginBottom = "10px";

    // Bestätigungsbutton
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Bestätigen";
    confirmBtn.style.padding = "10px 20px";
    confirmBtn.style.fontSize = "16px";
    confirmBtn.style.cursor = "pointer";

    // Bei Klick: Hintergrundfarbe setzen
    confirmBtn.addEventListener("click", async() => {
        document.body.style.backgroundColor = colorPicker.value;

        const selectedColor = colorPicker.value;
        document.body.style.backgroundColor = selectedColor;
        // Farbe speichern
        localStorage.setItem("backgroundColor", selectedColor);
        // Farbe anwenden
        document.body.style.backgroundColor = selectedColor;
        document.body.removeChild(overlay); // Farbauswahl schließen
    });

    overlay.appendChild(colorPicker);
    overlay.appendChild(confirmBtn);
    document.body.appendChild(overlay);
});




const deleteDB = (dbName) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
        console.log(`Datenbank ${dbName} wurde erfolgreich gelöscht.`);
    };

    request.onerror = (event) => {
        console.error(`Fehler beim Löschen der Datenbank ${dbName}: `, event.target.error);
    };

    request.onblocked = () => {
        console.warn(`Die Datenbank ${dbName} konnte nicht gelöscht werden, da sie von anderen Fenstern/Tabellen verwendet wird.`);
    };
};

// Beispielaufruf, um die "MyDiaryApp"-Datenbank zu löschen:
//deleteDB("MyDiaryApp");