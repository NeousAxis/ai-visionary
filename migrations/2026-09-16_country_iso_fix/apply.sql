-- Correction des pays non ISO dans aya_registry.country_legal (16 septembre 2026)
-- Postgres VPS aya_local. 309 lignes : 265 noms locaux (日本, 台灣, РФ...) et 44 codes
-- ASCII hors norme (FL, WA, CS, EU...), toutes FUSION-WDC, FUSION-WDC-MIN3, AYA-BOT ou
-- AYO-SCAN, aucune payante. Chaque ligne porte l'indice qui fonde sa valeur. XX (pays
-- inconnu, 2 921 lignes) et XK (Kosovo, 2 lignes) restent tels quels.
--
-- Une seule transaction : garde-fou (fonctions + trigger), verrou et sauvegarde CSV des
-- lignes visées, UPDATE gardé par l'ancienne valeur, contrôles, comptes avant/après.
--
-- Répétition, rien n'est écrit (ROLLBACK final) :
--   psql -h localhost -U aya_app -d aya_local -X -v commit=0 \
--        -v backup=/home/ubuntu/backups/aya_registry_country_fix_<horodatage>_repetition.csv -f apply.sql
-- Application réelle (accord de Cyril requis) : même commande avec -v commit=1.
-- Retour arrière : rollback.sql avec le CSV de sauvegarde.

\set ON_ERROR_STOP on
\if :{?commit}
\else
    \echo 'Variable commit manquante : -v commit=0 pour répéter, -v commit=1 pour appliquer.'
    \quit
\endif
\if :{?backup}
\else
    \echo 'Variable backup manquante : chemin du CSV de sauvegarde.'
    \quit
\endif

BEGIN;
-- Les lectures du site ne sont jamais bloquées ; si une écriture concurrente tient le
-- verrou plus de 5 s, on abandonne proprement plutôt que d'attendre.
SET LOCAL lock_timeout = '5s';

-- 1. Garde-fou : aya_is_valid_country_code() + trigger trg_aya_normalize_country
\ir ../2026-09-16_aya_registry_country_iso_guard.sql

-- 2. Correspondances ligne par ligne
CREATE TEMP TABLE country_fix (
    entity_id uuid PRIMARY KEY,
    old_value text NOT NULL,
    new_value text NOT NULL CHECK (aya_is_valid_country_code(new_value)),
    evidence  text NOT NULL
) ON COMMIT DROP;

COPY country_fix (entity_id, old_value, new_value, evidence) FROM STDIN;
7cda091d-a8c1-51df-8d11-b37c58fa27ee	AC	SE	ccTLD .se
a250a411-350e-5755-aa24-05af287b8d1f	AC	GB	.co.uk
be08c502-fa4a-533b-9b1a-763125fdfbc1	AC	FR	ccTLD .fr
2a567682-9bda-5879-92fa-5d3870c5dfd9	BC	CA	Cowichan Bay, indicatif 250 (Colombie-Britannique)
0f1b080d-51a6-5b3d-a4fc-619ef6f983cd	CS	CZ	tél. +420, Staré Město (Prague)
6437c571-1261-5973-ba6d-fe1796061632	CS	CZ	ccTLD .cz
7febadf0-d89c-5149-a4c7-64189011b6f9	CS	CZ	ccTLD .cz
a82dd969-0739-5bab-8917-7eb5ed64dbb1	CS	CZ	ccTLD .cz, tél. +420, Praha
dae8e1c4-1b2a-5c31-85d2-7be8cfd24c2b	CS	CZ	ccTLD .cz
9ceaaad8-b379-5424-9fee-ce28b90cd46d	DC	US	Washington, indicatif 202
4f211f7c-f9df-57b4-9f20-2be95a73a4e6	EI	IE	Dublin, tél. +353
4241b8f3-0454-50dc-a524-16ec2ed56854	EN	DE	adresse à Kabelsketal, marque albenisa.de
768898ea-b483-558a-938b-2342dd23e0d0	EN	US	Golden, indicatif 720 (Colorado)
e174fe6e-7acc-5d0f-8c60-8a1066c56087	EN	DE	adresse à Hilden, marque yogabox.de
42f0f497-354d-4be0-b8c9-ebb8980759d2	EU	XX	groupealliance.eu : aucun indice de pays, inconnu
79c06c0a-ea89-5096-a7b5-5638483e8868	EU	XX	epson.eu : aucun indice de pays, inconnu
fae224f6-c9be-5fd0-b639-9aaa10c36272	EU	US	Washington DC, indicatif 202
0804b2e3-b1df-57ea-b594-b80b6857c1e3	FL	US	Cocoa, indicatif 321 (Floride)
7dd97b7b-593c-587c-86df-498a67b28bdc	FL	US	Pembroke Pines, tél. +1 954 (Floride)
81127e4d-e1bf-5cd7-8a75-b4dc837fca9a	FL	US	indicatif 407 (Floride)
a96e54d1-dbb5-5bf4-a246-37eef2d3b062	FL	US	Orlando, indicatif 407 (Floride)
0d32e5df-e219-5b4e-be7f-fa5e9aadd799	JA	JP	.jp, 横浜市
d39f8d93-338e-5d35-ba92-1dd24daf9ea3	JA	JP	.co.jp, 熊谷市
ef63f483-97c6-5161-9620-ad2ab437b704	JA	JP	京都市, indicatif 075
758b5e54-94ec-5532-a681-d9abf47087fc	NH	NL	ccTLD .nl, tél. 0031, Oude Meer
2eb10179-860e-5dd0-8b15-748da5385267	NY	US	New York, tél. +1 212
8db2a98c-02ce-5bcd-8255-6a7fe6c4e97b	NY	US	New York
c2a47834-feb7-5127-8373-f3024204716b	NY	US	tél. +1 845 (Rockland, New York)
4264e033-60a8-5a9a-a464-33079d160794	ON	CA	Markham (Ontario)
78d509e9-d0ba-5a29-98be-423d91fceea9	PI	DE	ccTLD .de
31409ebf-da27-587b-addd-7f2faf809cca	RH	HR	ccTLD .hr, tél. +385, Rijeka
4e09694f-082e-51d8-85d5-7848463c5ca2	RM	IT	ccTLD .it, Roma, tél. 0039
75b8bb9b-95b5-5b85-87f4-517802cb48de	RM	IT	ccTLD .it, Roma, tél. 0039
c4c1807b-f15c-5ae8-b2dc-c983fdace6e2	SP	ES	Barcelona, tél. +34
cee5572a-1b80-5363-a4a6-62b96145c253	SP	ES	Madrid, tél. +34
5f5f6b35-62ba-5f4d-b4ef-bb0945688337	TX	US	Carrollton, indicatif 214 (Texas)
9e303dd6-7702-51c5-9b40-139ed8e76760	TX	US	Hereford, indicatif 806 (Texas)
c86f6322-4146-57e0-ad7d-cb201e0b8a8f	UN	US	West Chester, indicatif 610 (Pennsylvanie)
5aee5054-c23a-5702-a79f-8af7c52f904b	WA	US	Seattle, indicatif 206
a09e554f-9234-5e59-ba9c-76538a17960b	WA	US	Seattle, indicatif 206
fe844bb0-ac37-5533-8693-e614f512aec0	WA	AU	.com.au, tél. +61, West Perth
0217a11f-f032-5319-ac89-4bbd6c7b5c12	ZN	ZA	.co.za, Jozini (KwaZulu-Natal)
e75d9f5f-bf9d-51d5-9da0-ab2c6672e661	ZZ	XX	ZZ signifie inconnu, aucun indice fiable
f010bb5e-79b1-5c29-a8d7-152cec0dfbde	ZZ	XX	ZZ signifie inconnu, aucun indice fiable
c0add962-ff9d-5368-b1d2-93fe3e63b363	КГ	RU	Санкт-Петербург, domaine .рф, tél. +7 812 (pas le Kirghizistan)
fe64a588-f62b-50bd-aa30-b1079ce7eed4	КЗ	KZ	Алматы
65ed406e-c285-503b-a701-8a49e2c6b163	РБ	BY	ccTLD .by, tél. +375, Минск
9a2bbe54-54a4-526e-8205-a356b6b5391b	РБ	BY	ccTLD .by, tél. +375, Минск
b2000cb9-8e09-534f-acfb-0fce4bb67995	РБ	BY	ccTLD .by, tél. +375, Минск
d7534c9a-5b4d-59b4-824e-53cfd949b058	РБ	BY	ccTLD .by, tél. +375, Минск
2002adbd-c808-5830-8b8f-b7f4834684b7	РФ	RU	nom de pays sans ambiguïté « РФ »
3566f097-3918-5e2c-8452-0d793eba61d8	РФ	RU	nom de pays sans ambiguïté « РФ »
4702ed92-7c1f-5a86-9d6f-2cc6725d1e49	РФ	RU	nom de pays sans ambiguïté « РФ »
50ccca98-8c13-56af-8a51-3fa02f257138	РФ	RU	nom de pays sans ambiguïté « РФ »
5bae80d3-703e-5606-b11e-8b0135ca38cf	РФ	RU	nom de pays sans ambiguïté « РФ »
6dfefd0f-19fb-5a6b-a02e-8f5a674895b0	РФ	RU	nom de pays sans ambiguïté « РФ »
cb35e38b-97fa-5ace-9edd-0147d04c690a	РФ	RU	nom de pays sans ambiguïté « РФ »
df4cf84a-a82f-5206-a984-c400f4e720ed	РФ	RU	nom de pays sans ambiguïté « РФ »
f5da210e-f399-54f1-9db3-2b11901e5400	РФ	RU	nom de pays sans ambiguïté « РФ »
7c4e14ce-0dcf-5383-82dd-734d71ec8e9c	中国	CN	nom de pays sans ambiguïté « 中国 »
0b2cfda0-bb92-5f0e-8526-971cdeea7419	台灣	TW	nom de pays sans ambiguïté « 台灣 »
0b39eda1-96fc-5f8a-811b-5413c0d6663d	台灣	TW	nom de pays sans ambiguïté « 台灣 »
12a3bd66-9b4a-5af8-a97b-a1f7c2d7d59d	台灣	TW	nom de pays sans ambiguïté « 台灣 »
1c9dab5a-ac03-5460-919a-22ffde624ae7	台灣	TW	nom de pays sans ambiguïté « 台灣 »
20077140-5834-57b9-a76d-4156c972cc0a	台灣	TW	nom de pays sans ambiguïté « 台灣 »
2a6707c2-dc9a-5b3c-9d10-90c479a0e31c	台灣	TW	nom de pays sans ambiguïté « 台灣 »
2a999ccc-e712-50d2-a893-c49fcfaabdc7	台灣	TW	nom de pays sans ambiguïté « 台灣 »
2f6746fb-4a82-51a5-b2e2-0fc110335cd2	台灣	TW	nom de pays sans ambiguïté « 台灣 »
30536e3e-1350-59e5-b987-9583dc791f59	台灣	TW	nom de pays sans ambiguïté « 台灣 »
35b4085d-0dfb-5d3b-ad82-8c849d4e0d70	台灣	TW	nom de pays sans ambiguïté « 台灣 »
393fc79b-24dd-5568-9408-0ae14b13af79	台灣	TW	nom de pays sans ambiguïté « 台灣 »
3b48f23a-c74f-5ecb-90a3-57de295f8a49	台灣	TW	nom de pays sans ambiguïté « 台灣 »
3b97b08a-8f8c-5994-ab27-cf533b8192f0	台灣	TW	nom de pays sans ambiguïté « 台灣 »
3fe9eeea-2d09-55d4-b25f-52a811b1299d	台灣	TW	nom de pays sans ambiguïté « 台灣 »
45750e82-76e5-53f2-b22a-662c351b0bd0	台灣	TW	nom de pays sans ambiguïté « 台灣 »
4bebd62c-34ec-5415-bd1c-a17a6f4f356d	台灣	TW	nom de pays sans ambiguïté « 台灣 »
5188b786-f5d8-59a6-88d0-5d8cce557257	台灣	TW	nom de pays sans ambiguïté « 台灣 »
523a9951-e1b0-52e9-be98-d2a06a2a8529	台灣	TW	nom de pays sans ambiguïté « 台灣 »
52d75fba-2caa-5b75-9e89-f15ad2f616ba	台灣	TW	nom de pays sans ambiguïté « 台灣 »
53afe986-d4ad-534b-8045-0c03d34c7fe4	台灣	TW	nom de pays sans ambiguïté « 台灣 »
615d1086-fc95-56a7-8c59-3405b864bf13	台灣	TW	nom de pays sans ambiguïté « 台灣 »
652bf613-02b7-5c2d-9376-63a4ec40b71f	台灣	TW	nom de pays sans ambiguïté « 台灣 »
67027d2a-972a-5f7b-8ed3-3f1acb60962f	台灣	TW	nom de pays sans ambiguïté « 台灣 »
6b86e33f-00d2-5c0a-9b77-f99dab8d75e0	台灣	TW	nom de pays sans ambiguïté « 台灣 »
6d716753-65a9-5054-bfe4-6a8aada1fc70	台灣	TW	nom de pays sans ambiguïté « 台灣 »
6e2f454e-d9dc-5079-9b69-c5c45101e81f	台灣	TW	nom de pays sans ambiguïté « 台灣 »
71a74362-65d8-53a0-8b5e-4a1e9a2fb7ac	台灣	TW	nom de pays sans ambiguïté « 台灣 »
7467e2cd-0e73-5c3b-b468-11bcd77125ae	台灣	TW	nom de pays sans ambiguïté « 台灣 »
74697a3f-d2e8-5141-8d6a-862f69b2f7a2	台灣	TW	nom de pays sans ambiguïté « 台灣 »
7dac97d6-ad8a-521c-9b85-3b8dd3d6adea	台灣	TW	nom de pays sans ambiguïté « 台灣 »
7f518052-75a0-541b-9af5-374987f082a4	台灣	TW	nom de pays sans ambiguïté « 台灣 »
831a47e4-954a-5535-b0b2-4343f91318d5	台灣	TW	nom de pays sans ambiguïté « 台灣 »
8364f640-c25b-52e2-a897-fe7614ec0c9d	台灣	TW	nom de pays sans ambiguïté « 台灣 »
8b545812-05bc-52a0-a34a-307c2782deec	台灣	TW	nom de pays sans ambiguïté « 台灣 »
901658bd-b3cd-5392-968e-7216803d1f37	台灣	TW	nom de pays sans ambiguïté « 台灣 »
956b37d6-e2e7-59e4-877c-4bfd415a1da4	台灣	TW	nom de pays sans ambiguïté « 台灣 »
9ef56c3c-e21e-5038-82ed-e48faa67c5b1	台灣	TW	nom de pays sans ambiguïté « 台灣 »
a09d96e4-aad9-53f5-8b9a-1d80415c27d8	台灣	TW	nom de pays sans ambiguïté « 台灣 »
a669f7b9-c6ff-54d0-91ad-e17add549ce7	台灣	TW	nom de pays sans ambiguïté « 台灣 »
ac862ed8-4566-54d9-9064-6cc885866e67	台灣	TW	nom de pays sans ambiguïté « 台灣 »
ac892186-7587-5bbe-9714-d8ce07a56770	台灣	TW	nom de pays sans ambiguïté « 台灣 »
bc89f3ed-efd6-5af9-a475-43e92add19c5	台灣	TW	nom de pays sans ambiguïté « 台灣 »
bce143b7-694e-5f7a-8cbb-f504b2d0b1bc	台灣	TW	nom de pays sans ambiguïté « 台灣 »
bdee613b-df99-5cef-a917-bc41ea8765f9	台灣	TW	nom de pays sans ambiguïté « 台灣 »
bf7dd978-7e43-5fae-9b87-6fc78a3cd7ee	台灣	TW	nom de pays sans ambiguïté « 台灣 »
bfd87656-49b5-595e-9439-517d9390d6b7	台灣	TW	nom de pays sans ambiguïté « 台灣 »
bff168be-fe26-5b1d-b839-83c2329c689d	台灣	TW	nom de pays sans ambiguïté « 台灣 »
c50f436a-f5fe-5486-9505-5486f6381ff5	台灣	TW	nom de pays sans ambiguïté « 台灣 »
c6827e1b-0ee0-51df-9627-081090f6eb59	台灣	TW	nom de pays sans ambiguïté « 台灣 »
c7c2efb0-f402-5933-9928-8e15d9f26177	台灣	TW	nom de pays sans ambiguïté « 台灣 »
c8fe6a85-c391-5340-b51c-50c6dd4d9275	台灣	TW	nom de pays sans ambiguïté « 台灣 »
cc6b5489-b33f-536a-bf1f-332e54d0e238	台灣	TW	nom de pays sans ambiguïté « 台灣 »
cee4857b-86a8-5a52-b136-bb449abd96a7	台灣	TW	nom de pays sans ambiguïté « 台灣 »
dcfb53a8-3057-5b01-8d3a-2136d88477e3	台灣	TW	nom de pays sans ambiguïté « 台灣 »
df81b386-8596-5e49-b6a6-2c3650592204	台灣	TW	nom de pays sans ambiguïté « 台灣 »
e660a3c6-c297-5299-920b-f52e8cbeea69	台灣	TW	nom de pays sans ambiguïté « 台灣 »
f2042eda-aa98-52f1-bbcf-41b3e854be28	台灣	TW	nom de pays sans ambiguïté « 台灣 »
ff32766e-3cb8-5fe7-97a2-534990cd8550	台灣	TW	nom de pays sans ambiguïté « 台灣 »
59f96289-3193-5fbd-8161-df72c0298a17	大阪	JP	Osaka (大阪), indicatif 06
0352acde-5bc6-5359-8ddc-c11136b69b7d	日本	JP	nom de pays sans ambiguïté « 日本 »
03b378d0-dbc6-5240-bfaf-70ada5711752	日本	JP	nom de pays sans ambiguïté « 日本 »
04206cc5-1dc8-54bc-a846-8b8bf0950d13	日本	JP	nom de pays sans ambiguïté « 日本 »
05d9ef28-f9c6-59ba-a6d3-6047a36aaf94	日本	JP	nom de pays sans ambiguïté « 日本 »
07258347-c1a3-5734-a7c4-5f801f93ec03	日本	JP	nom de pays sans ambiguïté « 日本 »
08639f5e-fc5b-528c-aa18-c752c767f305	日本	JP	nom de pays sans ambiguïté « 日本 »
0f9b1ec2-6fa8-5cab-a3ff-be64f5349e83	日本	JP	nom de pays sans ambiguïté « 日本 »
1062ce68-2ae7-51cb-997d-adcc34cb6484	日本	JP	nom de pays sans ambiguïté « 日本 »
139a1d4e-5863-5b9e-aa78-ff277db0f978	日本	JP	nom de pays sans ambiguïté « 日本 »
140d9262-4ac4-51c1-ab0b-1ed446ec83dc	日本	JP	nom de pays sans ambiguïté « 日本 »
14ffdef2-2cbe-5c87-8f60-214f401710c1	日本	JP	nom de pays sans ambiguïté « 日本 »
182ae90a-5955-5a4e-a946-e7868a2ff210	日本	JP	nom de pays sans ambiguïté « 日本 »
188a460c-3336-543c-b720-b6fb39ee6f91	日本	JP	nom de pays sans ambiguïté « 日本 »
194b1acb-b121-5e82-8f28-197857e4f2f7	日本	JP	nom de pays sans ambiguïté « 日本 »
1a476859-0718-52b1-9881-fe6e3625712b	日本	JP	nom de pays sans ambiguïté « 日本 »
1dd756e7-6a0b-5459-aed1-ec6068e9e814	日本	JP	nom de pays sans ambiguïté « 日本 »
214530d7-231a-5d3e-9dc1-24c1ecba951b	日本	JP	nom de pays sans ambiguïté « 日本 »
218f796d-7880-5374-b60f-cd55237cb785	日本	JP	nom de pays sans ambiguïté « 日本 »
219a51d8-026e-59cb-b86b-36fb08f7e9ea	日本	JP	nom de pays sans ambiguïté « 日本 »
227c702c-a58d-56d3-a2ba-7df4255aad34	日本	JP	nom de pays sans ambiguïté « 日本 »
26a0e785-dda7-5aff-86f3-d06f465da7cd	日本	JP	nom de pays sans ambiguïté « 日本 »
2718af15-1e98-5031-a932-54a0642462ef	日本	JP	nom de pays sans ambiguïté « 日本 »
2c40f636-1d46-51c1-961b-c9fc06e69915	日本	JP	nom de pays sans ambiguïté « 日本 »
2f16ddf2-0273-5848-861e-4f5d9f175ac1	日本	JP	nom de pays sans ambiguïté « 日本 »
2f74cf0f-ea08-50d4-9d67-8b9e594c6147	日本	JP	nom de pays sans ambiguïté « 日本 »
3130f83d-5ae1-59b0-b7af-1234d53a0d96	日本	JP	nom de pays sans ambiguïté « 日本 »
3582d6f2-0790-5ac7-a413-e2fadd064e5b	日本	JP	nom de pays sans ambiguïté « 日本 »
36c69606-dfbb-5e48-92ad-a91b61ac348a	日本	JP	nom de pays sans ambiguïté « 日本 »
373041d7-36f3-54e1-b54b-c573bd2fff35	日本	JP	nom de pays sans ambiguïté « 日本 »
3ac0334a-eebb-53fb-bf8a-ee9fce2bde8e	日本	JP	nom de pays sans ambiguïté « 日本 »
3eaaa511-2042-5fd0-a01f-297fe5544cf5	日本	JP	nom de pays sans ambiguïté « 日本 »
40fb2111-e9e7-5714-8efd-4cda5c448582	日本	JP	nom de pays sans ambiguïté « 日本 »
4156e8f5-cc45-5bf3-ae30-739c0447ed4f	日本	JP	nom de pays sans ambiguïté « 日本 »
445b3e30-d57e-550f-8391-d90f2d705638	日本	JP	nom de pays sans ambiguïté « 日本 »
46d8b6e6-189d-5a4e-9811-f1271fd9af2d	日本	JP	nom de pays sans ambiguïté « 日本 »
4728afcf-d6f2-5b3c-a043-5656eddbe2b0	日本	JP	nom de pays sans ambiguïté « 日本 »
48127c6b-157b-5881-917a-17fd33f899b0	日本	JP	nom de pays sans ambiguïté « 日本 »
48258797-fb47-5945-8b89-ac0b195919bd	日本	JP	nom de pays sans ambiguïté « 日本 »
493c9c58-7a77-5d48-8065-69a1d36276c3	日本	JP	nom de pays sans ambiguïté « 日本 »
4b5079cf-98d8-5dd6-8995-aca55a4e8015	日本	JP	nom de pays sans ambiguïté « 日本 »
4ff98767-f4ec-5273-88cf-853f496d8a6b	日本	JP	nom de pays sans ambiguïté « 日本 »
52ee07f4-287c-5ee8-84ca-2b0adb05c46d	日本	JP	nom de pays sans ambiguïté « 日本 »
5306a631-9da5-57c4-802f-dc1223b91f53	日本	JP	nom de pays sans ambiguïté « 日本 »
53772852-495a-567b-93b6-8586f94ede8d	日本	JP	nom de pays sans ambiguïté « 日本 »
553b2a37-34fa-5e77-83d9-be4718a6c6f3	日本	JP	nom de pays sans ambiguïté « 日本 »
55546c81-33e4-5873-b3d7-42c210870e1c	日本	JP	nom de pays sans ambiguïté « 日本 »
559ad49b-c6c1-5caa-a130-26b0ac61e008	日本	JP	nom de pays sans ambiguïté « 日本 »
55b4bf21-6440-516e-b3df-10517878a5b5	日本	JP	nom de pays sans ambiguïté « 日本 »
55e16583-9f19-57f2-9819-212068dab0d0	日本	JP	nom de pays sans ambiguïté « 日本 »
568a04f5-769c-5449-a41d-ae5dc6d56260	日本	JP	nom de pays sans ambiguïté « 日本 »
5a5d6762-3d76-50ca-b12d-32743252085d	日本	JP	nom de pays sans ambiguïté « 日本 »
5c31fe45-0baa-5b43-9586-82c27a9fdffa	日本	JP	nom de pays sans ambiguïté « 日本 »
5d6c6c9d-e4e1-5638-a8f5-5620ce68f38d	日本	JP	nom de pays sans ambiguïté « 日本 »
5d943a69-e77f-59de-92c8-0127aab10dd4	日本	JP	nom de pays sans ambiguïté « 日本 »
5e668867-a7b7-57e6-8689-ca774c956e6b	日本	JP	nom de pays sans ambiguïté « 日本 »
60d7e949-62cf-5697-9438-b1b106968578	日本	JP	nom de pays sans ambiguïté « 日本 »
60e21a5d-5d06-5ac0-adfe-95eaf8092193	日本	JP	nom de pays sans ambiguïté « 日本 »
61349f0f-026c-5516-b1a8-ce366fade382	日本	JP	nom de pays sans ambiguïté « 日本 »
627cbfe4-5038-5f8f-b235-debd259a250e	日本	JP	nom de pays sans ambiguïté « 日本 »
63ba5d4d-166a-5974-acc3-5e3c32152e60	日本	JP	nom de pays sans ambiguïté « 日本 »
63e02e2e-a4db-55c4-bfa0-7012650c62a1	日本	JP	nom de pays sans ambiguïté « 日本 »
65455d57-4b96-57d8-9ee8-4df2abf8f66f	日本	JP	nom de pays sans ambiguïté « 日本 »
67089893-cfbc-5db0-a636-958705f0dcc1	日本	JP	nom de pays sans ambiguïté « 日本 »
67bfd889-2996-539f-a160-fdbe0a927f8c	日本	JP	nom de pays sans ambiguïté « 日本 »
6885d89e-b19c-516a-a92f-c4663b85a3bd	日本	JP	nom de pays sans ambiguïté « 日本 »
6921b028-f011-5406-a550-ffcafac7bdcd	日本	JP	nom de pays sans ambiguïté « 日本 »
6c7b1412-e61a-5951-9d2d-2b4fef33b093	日本	JP	nom de pays sans ambiguïté « 日本 »
6cb8a860-8b3d-5742-8ee6-a9f7817958fb	日本	JP	nom de pays sans ambiguïté « 日本 »
6dccd018-d480-550f-ab6c-3b39a68ddf60	日本	JP	nom de pays sans ambiguïté « 日本 »
6e36be47-44be-52c1-9aa0-c6ff0d31464d	日本	JP	nom de pays sans ambiguïté « 日本 »
6f37b0bf-6da4-51ba-bd4f-ffd3e122dd66	日本	JP	nom de pays sans ambiguïté « 日本 »
71732673-d981-57ff-82f8-01b83485c7f3	日本	JP	nom de pays sans ambiguïté « 日本 »
751ec104-e983-578a-8b23-24092e684b55	日本	JP	nom de pays sans ambiguïté « 日本 »
7522e032-7d68-5a23-93fa-eda1e82222b0	日本	JP	nom de pays sans ambiguïté « 日本 »
75a590cb-164c-5696-96d3-eb327f352001	日本	JP	nom de pays sans ambiguïté « 日本 »
77fd4da7-5dd4-5ad5-897a-9eb9e6c03ca6	日本	JP	nom de pays sans ambiguïté « 日本 »
78331ff0-ec66-5f88-a29f-9e92fe2f6211	日本	JP	nom de pays sans ambiguïté « 日本 »
79a1471a-47d7-5cb6-9c71-024e7176e313	日本	JP	nom de pays sans ambiguïté « 日本 »
7a0d84d8-7854-5557-8577-f4f5fe35044c	日本	JP	nom de pays sans ambiguïté « 日本 »
7a6779a3-dad7-5bb1-ae5c-ebefac4f4180	日本	JP	nom de pays sans ambiguïté « 日本 »
7a6b93cc-b047-5d1a-a0cd-bd85206826c1	日本	JP	nom de pays sans ambiguïté « 日本 »
7a9d2d5e-fae2-57f1-afd4-674209678c1d	日本	JP	nom de pays sans ambiguïté « 日本 »
7af560a1-8aad-5e2e-816e-10c091ee3e43	日本	JP	nom de pays sans ambiguïté « 日本 »
7d0da4bc-4e7d-51f7-9064-9f69bc142c38	日本	JP	nom de pays sans ambiguïté « 日本 »
7d20c877-7956-51c5-b23b-3a938bc752e3	日本	JP	nom de pays sans ambiguïté « 日本 »
7f5ed54c-b815-5c24-bebf-c2cb556b2efd	日本	JP	nom de pays sans ambiguïté « 日本 »
80558c9d-e4d8-55e9-9b0b-d4fd44209269	日本	JP	nom de pays sans ambiguïté « 日本 »
815397ce-6c81-5e41-95fe-c3a0d43f0fbd	日本	JP	nom de pays sans ambiguïté « 日本 »
82b26e4f-6ec1-5149-bbb2-39e9fefad05a	日本	JP	nom de pays sans ambiguïté « 日本 »
83ba904a-6917-54ed-99b3-ece706e32168	日本	JP	nom de pays sans ambiguïté « 日本 »
842a7a56-3e3a-5180-a14e-589ba98bddd2	日本	JP	nom de pays sans ambiguïté « 日本 »
85879768-a163-56a5-85ee-dab00f83fff5	日本	JP	nom de pays sans ambiguïté « 日本 »
85d75640-ade2-5ae1-b52a-b2ea776a0a80	日本	JP	nom de pays sans ambiguïté « 日本 »
86ad8461-6a53-5ae9-b70f-69ef086a44ca	日本	JP	nom de pays sans ambiguïté « 日本 »
87713b44-8648-5021-accc-712bf31b47a1	日本	JP	nom de pays sans ambiguïté « 日本 »
879ad6e5-0855-5757-a31d-3ed8573f9263	日本	JP	nom de pays sans ambiguïté « 日本 »
88a012ea-e749-5a97-946d-47d92219d135	日本	JP	nom de pays sans ambiguïté « 日本 »
89da08e4-3639-538f-83d4-51b57876d7ab	日本	JP	nom de pays sans ambiguïté « 日本 »
8ba8554c-256f-55a7-9b13-69dbe0f6cde4	日本	JP	nom de pays sans ambiguïté « 日本 »
8cc202e0-cc99-53a8-9638-a1ea5a77228e	日本	JP	nom de pays sans ambiguïté « 日本 »
91d067ed-7082-5ff7-af1b-83ecb6e9d598	日本	JP	nom de pays sans ambiguïté « 日本 »
93fefd85-c071-5db8-a0b6-5436b1f3f694	日本	JP	nom de pays sans ambiguïté « 日本 »
97b0bb18-7656-59cd-aaa9-6138f6bd0cbd	日本	JP	nom de pays sans ambiguïté « 日本 »
99bafb14-f671-58dd-8584-336305f2e6a0	日本	JP	nom de pays sans ambiguïté « 日本 »
9c091f4d-6c00-5f07-ad97-96edc1fe2562	日本	JP	nom de pays sans ambiguïté « 日本 »
9c1ac9c2-ee03-5578-9596-25656af625c1	日本	JP	nom de pays sans ambiguïté « 日本 »
9c220535-0ad3-54ff-9c32-33c2c8cafe21	日本	JP	nom de pays sans ambiguïté « 日本 »
9d8fea5b-25d1-51c8-a35d-bb690eae0db8	日本	JP	nom de pays sans ambiguïté « 日本 »
9e8dfca4-6293-59f1-99bb-e856e97b40e9	日本	JP	nom de pays sans ambiguïté « 日本 »
9f14f785-e915-5ad2-b12c-f204a3165d38	日本	JP	nom de pays sans ambiguïté « 日本 »
a06fe373-2648-5386-b2e9-502f200e8646	日本	JP	nom de pays sans ambiguïté « 日本 »
a0a116be-099e-5382-bee7-1b1a1ace0775	日本	JP	nom de pays sans ambiguïté « 日本 »
a2061194-5334-5196-890f-91e637af6e4d	日本	JP	nom de pays sans ambiguïté « 日本 »
a423d335-2d9b-56a2-8304-de226dc0c2ce	日本	JP	nom de pays sans ambiguïté « 日本 »
a60db5d8-c2a1-5bda-bccb-82f9f08aeca3	日本	JP	nom de pays sans ambiguïté « 日本 »
a8057493-1610-5634-bed6-001889605502	日本	JP	nom de pays sans ambiguïté « 日本 »
aa01c438-d03c-5d6d-8318-38b97af1c845	日本	JP	nom de pays sans ambiguïté « 日本 »
abbf9b48-6d40-5d35-96eb-08827541134e	日本	JP	nom de pays sans ambiguïté « 日本 »
ac44893d-7e06-5e0a-85a0-32b5d385db63	日本	JP	nom de pays sans ambiguïté « 日本 »
aff91458-af26-55de-9dc3-8a7afdf48f7f	日本	JP	nom de pays sans ambiguïté « 日本 »
b21916f6-d7b0-524c-ae44-ee6c6d347e8f	日本	JP	nom de pays sans ambiguïté « 日本 »
b2c3cf10-45c9-550e-8610-43481aeabd86	日本	JP	nom de pays sans ambiguïté « 日本 »
b2c73d46-3604-539a-ae4e-03c010afaff9	日本	JP	nom de pays sans ambiguïté « 日本 »
b4115500-55f7-5c0d-878c-7eafb4976836	日本	JP	nom de pays sans ambiguïté « 日本 »
b43aabeb-94c7-54f9-a9ec-b6ee4d3ee9dc	日本	JP	nom de pays sans ambiguïté « 日本 »
b4fda898-0230-56d2-95cb-0fb5b196754f	日本	JP	nom de pays sans ambiguïté « 日本 »
b7a2c9e9-9eed-51b9-bf30-baadd864a34f	日本	JP	nom de pays sans ambiguïté « 日本 »
b8ea620a-dc0c-50f8-a397-da05e5cdaed4	日本	JP	nom de pays sans ambiguïté « 日本 »
b94ade9e-3efa-55bf-bded-8e1a6aa4f934	日本	JP	nom de pays sans ambiguïté « 日本 »
ba23a5c8-d737-596c-a31a-5093e637abb0	日本	JP	nom de pays sans ambiguïté « 日本 »
bc30fc54-4bcb-5764-b620-f18b463cfa0e	日本	JP	nom de pays sans ambiguïté « 日本 »
bf0b305a-93a5-555d-8980-ccd05808f3dc	日本	JP	nom de pays sans ambiguïté « 日本 »
bf939f4b-7aad-55d0-92dd-7a392b905c17	日本	JP	nom de pays sans ambiguïté « 日本 »
c0a50bc3-e777-54a4-8b09-abec2f31578f	日本	JP	nom de pays sans ambiguïté « 日本 »
c1569bed-2392-55b3-a753-e92691e11df6	日本	JP	nom de pays sans ambiguïté « 日本 »
c1db83cd-b531-5779-a847-02b4e6794c0d	日本	JP	nom de pays sans ambiguïté « 日本 »
c5dfd616-1660-5c68-860b-ccc82a249752	日本	JP	nom de pays sans ambiguïté « 日本 »
c618b789-56bf-542e-90e6-c81b79046a7e	日本	JP	nom de pays sans ambiguïté « 日本 »
c77c2df7-ad8c-5be4-a23b-b05ad824edc5	日本	JP	nom de pays sans ambiguïté « 日本 »
c932abf5-b31a-503c-9beb-3fdba12c22a8	日本	JP	nom de pays sans ambiguïté « 日本 »
ca6a06b3-dfda-5143-99de-bab6d13cc7e0	日本	JP	nom de pays sans ambiguïté « 日本 »
cb83c06a-630c-55ec-80b1-42000c67714f	日本	JP	nom de pays sans ambiguïté « 日本 »
cecb8b6e-2efe-5212-8f60-fc8943b0203a	日本	JP	nom de pays sans ambiguïté « 日本 »
d0a397cb-4783-5698-9314-ea44b59dd4e3	日本	JP	nom de pays sans ambiguïté « 日本 »
d2eba930-9b99-52ad-be08-992af0c71f61	日本	JP	nom de pays sans ambiguïté « 日本 »
d35ea110-7996-59a0-b12d-b892c2218d45	日本	JP	nom de pays sans ambiguïté « 日本 »
d4835449-0248-59a7-9b8b-3dbb96260f77	日本	JP	nom de pays sans ambiguïté « 日本 »
d90420f5-3127-5953-a744-06dbcd95cf61	日本	JP	nom de pays sans ambiguïté « 日本 »
d9069b37-a179-5aaa-9fac-8bc8848f92dd	日本	JP	nom de pays sans ambiguïté « 日本 »
d98a77a7-6fb5-5d32-88c5-98c017b1e40d	日本	JP	nom de pays sans ambiguïté « 日本 »
dc689a91-cde5-595f-ba6a-e1a83b2d2913	日本	JP	nom de pays sans ambiguïté « 日本 »
dcdba2b2-57b9-53da-b2fd-fe1120498e19	日本	JP	nom de pays sans ambiguïté « 日本 »
e124913a-3ed7-5b3c-880a-7e8f92c2d2ab	日本	JP	nom de pays sans ambiguïté « 日本 »
e20b7ae4-c044-5751-b7c9-02ccda59d79f	日本	JP	nom de pays sans ambiguïté « 日本 »
e2c766de-7340-5c74-8a8b-f20d6ab0d6b5	日本	JP	nom de pays sans ambiguïté « 日本 »
e37c6d9f-09ea-5456-a9e8-fcec832a7fc9	日本	JP	nom de pays sans ambiguïté « 日本 »
e507bebd-4a6b-5242-80e1-1fff509d7e9e	日本	JP	nom de pays sans ambiguïté « 日本 »
e5ba22ee-5ad1-51c2-bf70-aec3e108c3f5	日本	JP	nom de pays sans ambiguïté « 日本 »
e80a84f1-d147-5884-957c-e6d527534b53	日本	JP	nom de pays sans ambiguïté « 日本 »
e87837cf-3c76-5d57-a5a4-8e20202de506	日本	JP	nom de pays sans ambiguïté « 日本 »
e971ffb9-da00-5f1a-a3c0-9ac32e0028da	日本	JP	nom de pays sans ambiguïté « 日本 »
eb346d5e-2a40-5a67-89ef-934fc15d279d	日本	JP	nom de pays sans ambiguïté « 日本 »
eb7a96dc-85b6-5d6d-9b9e-ec99ae703073	日本	JP	nom de pays sans ambiguïté « 日本 »
eb88c2e9-6c2b-58ce-8b10-876ca44d3490	日本	JP	nom de pays sans ambiguïté « 日本 »
ec1fb5c9-1877-514c-a506-02ce08560b0c	日本	JP	nom de pays sans ambiguïté « 日本 »
f11c7f60-6021-574b-a09e-8fdfc71e2ee1	日本	JP	nom de pays sans ambiguïté « 日本 »
f24d10d1-6eef-56a7-9a64-061333aef6d6	日本	JP	nom de pays sans ambiguïté « 日本 »
f31fc45e-15c9-50cd-b56d-29475f153c38	日本	JP	nom de pays sans ambiguïté « 日本 »
f37d5d78-76c8-545b-a195-8bd5b85476be	日本	JP	nom de pays sans ambiguïté « 日本 »
f422eac5-02e6-5176-baf7-8b20fdbc1e61	日本	JP	nom de pays sans ambiguïté « 日本 »
f69b132e-11a7-5783-8fea-a07764e167c5	日本	JP	nom de pays sans ambiguïté « 日本 »
f6e67836-b8ed-532f-a312-c05a06eceb01	日本	JP	nom de pays sans ambiguïté « 日本 »
fb078784-ad7e-5332-bbb3-2ac8a90d529d	日本	JP	nom de pays sans ambiguïté « 日本 »
fbd61b48-b740-5ba6-816f-81939b790e77	日本	JP	nom de pays sans ambiguïté « 日本 »
fe05cd04-c4ea-5871-95a5-ccaab123fff1	日本	JP	nom de pays sans ambiguïté « 日本 »
7f30fbfa-3390-50ad-9303-4f65d2d8d21c	法國	FR	nom de pays sans ambiguïté « 法國 »
bab0c1e0-c4f1-55e0-937a-8bd3d27993cf	澳門	MO	nom de pays sans ambiguïté « 澳門 »
f801d29c-e82f-5653-b176-088ee8bb6841	澳門	MO	nom de pays sans ambiguïté « 澳門 »
c5ea57c0-e1be-5aec-8b98-c2ae90a2a3c1	美国	US	nom de pays sans ambiguïté « 美国 »
270b3e36-7ae6-597a-8e1f-30d2ae48834c	美國	US	nom de pays sans ambiguïté « 美國 »
0168c791-0c02-5052-947b-21f38f89705d	香港	HK	nom de pays sans ambiguïté « 香港 »
10a2bf1c-b95c-5f13-96b4-770e179b6414	香港	HK	nom de pays sans ambiguïté « 香港 »
3e94b939-a4ad-569f-a911-e676c95b3f92	香港	HK	nom de pays sans ambiguïté « 香港 »
40286891-1e92-5212-8eaa-c7bf90b97349	香港	HK	nom de pays sans ambiguïté « 香港 »
6d93190e-92ba-581f-b148-f85ca8078da9	香港	HK	nom de pays sans ambiguïté « 香港 »
c17402e1-51f2-5e68-b289-c925c020e247	香港	HK	nom de pays sans ambiguïté « 香港 »
c94ae60f-abad-589a-bb7a-0923fa923a34	香港	HK	nom de pays sans ambiguïté « 香港 »
f7c35aae-5804-58c8-b02d-7030cac8431b	香港	HK	nom de pays sans ambiguïté « 香港 »
6d6ee5c9-1f2f-5644-888f-15f30ff62ea7	호주	AU	nom de pays sans ambiguïté « 호주 »
acf96f54-0b15-5993-97f4-fb9ded6816f4	ＪＰ	JP	nom de pays sans ambiguïté « ＪＰ »
\.

SELECT count(*) AS correspondances FROM country_fix;

-- 3. Verrou puis sauvegarde complète des lignes visées
SELECT count(*) AS lignes_verrouillees
FROM (SELECT r.entity_id FROM aya_registry r JOIN country_fix f USING (entity_id) FOR UPDATE OF r) AS verrou;

COPY (SELECT r.* FROM aya_registry r JOIN country_fix f USING (entity_id) ORDER BY r.entity_id)
TO STDOUT WITH (FORMAT csv, HEADER true)
\g :backup
\echo 'Sauvegarde écrite :' :backup

-- 4. Avant
CREATE TEMP TABLE counts_before ON COMMIT DROP AS
SELECT country_legal, count(*) AS n, count(*) FILTER (WHERE NOT is_adult) AS n_public
FROM aya_registry GROUP BY 1;

SELECT count(*) AS lignes_non_iso_avant, count(DISTINCT country_legal) AS valeurs_non_iso_avant
FROM aya_registry
WHERE country_legal IS NOT NULL AND NOT aya_is_valid_country_code(country_legal);

-- 5. Correction, gardée par l'ancienne valeur, jamais sur une entité payante
UPDATE aya_registry r
SET country_legal = f.new_value, updated_at = now()
FROM country_fix f
WHERE r.entity_id = f.entity_id
  AND r.country_legal = f.old_value
  AND r.payment_completed IS NOT TRUE;

-- 6. Contrôles : tout est appliqué, plus aucune valeur non ISO, le trigger normalise
DO $$
DECLARE
    expected  int;
    applied   int;
    remaining int;
BEGIN
    SELECT count(*) INTO expected FROM country_fix;
    SELECT count(*) INTO applied
    FROM aya_registry r JOIN country_fix f USING (entity_id)
    WHERE r.country_legal = f.new_value;
    IF applied <> expected THEN
        RAISE EXCEPTION 'Correction incomplète : % lignes sur %', applied, expected;
    END IF;
    SELECT count(*) INTO remaining
    FROM aya_registry
    WHERE country_legal IS NOT NULL AND NOT aya_is_valid_country_code(country_legal);
    IF remaining <> 0 THEN
        RAISE EXCEPTION 'Il reste % lignes non ISO', remaining;
    END IF;
END $$;

CREATE TEMP TABLE country_trigger_probe (entity_id uuid, country_legal text, expected text) ON COMMIT DROP;
CREATE TRIGGER country_trigger_probe_normalize BEFORE INSERT ON country_trigger_probe
    FOR EACH ROW EXECUTE FUNCTION aya_normalize_country_legal();
INSERT INTO country_trigger_probe (country_legal, expected) VALUES
    (' 日本 ', NULL), ('ｊｐ', 'JP'), ('uk', 'GB'), ('FL', NULL), ('xx', 'XX'),
    ('', NULL), ('ch', 'CH'), ('XK', 'XK'), ('EU', NULL), (NULL, NULL);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM country_trigger_probe WHERE country_legal IS DISTINCT FROM expected) THEN
        RAISE EXCEPTION 'Le trigger ne normalise pas comme prévu';
    END IF;
END $$;
SELECT 'trigger OK' AS controle_trigger;

-- 7. Après : valeurs dont le compte a changé (public = hors contenu adulte)
SELECT valeur, sum(avant) AS avant, sum(apres) AS apres,
       sum(public_avant) AS public_avant, sum(public_apres) AS public_apres
FROM (
    SELECT country_legal AS valeur, n AS avant, 0 AS apres, n_public AS public_avant, 0 AS public_apres
    FROM counts_before
    UNION ALL
    SELECT country_legal, 0, count(*), 0, count(*) FILTER (WHERE NOT is_adult)
    FROM aya_registry GROUP BY country_legal
) AS t
GROUP BY valeur
HAVING sum(avant) <> sum(apres)
ORDER BY abs(sum(apres) - sum(avant)) DESC, valeur;

SELECT count(*) AS lignes_non_iso_apres
FROM aya_registry
WHERE country_legal IS NOT NULL AND NOT aya_is_valid_country_code(country_legal);

\if :commit
    COMMIT;
    \echo 'COMMIT : correction et garde-fou appliqués.'
\else
    ROLLBACK;
    \echo 'ROLLBACK : répétition, rien n''a été écrit.'
\endif
