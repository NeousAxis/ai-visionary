
"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';

// =========================================================================================
// ENTREPRISES ENREGISTRÉES — SEED DATA (Pays francophones uniquement : FR, CH, BE, LU)
// =========================================================================================
const SEED_ENTITIES: any[] = [
    // ── TECH & DIGITAL ──
    { id: "s-001", display_name: "Nexora Technologies", entity_type: "company", country_legal: "CH", sector_macro: "Tech & SaaS", description: "Solutions cloud et cybersécurité pour PME suisses.", asr_score: 94, status: "verified", website: "https://nexora.ch" },
    { id: "s-002", display_name: "Datafly Analytics", entity_type: "company", country_legal: "FR", sector_macro: "Data & IA", description: "Plateforme d'analyse prédictive pour le retail.", asr_score: 91, status: "verified", website: "https://datafly.fr" },
    { id: "s-003", display_name: "PixelForge Studio", entity_type: "company", country_legal: "FR", sector_macro: "Design & UX", description: "Agence de design produit et expérience utilisateur.", asr_score: 86, status: "verified", website: "https://pixelforge.studio" },
    { id: "s-004", display_name: "Codewave Solutions", entity_type: "company", country_legal: "BE", sector_macro: "Développement Web", description: "Développement d'applications web et mobiles sur mesure.", asr_score: 88, status: "verified", website: "https://codewave.be" },
    { id: "s-005", display_name: "Synthetiq AI", entity_type: "company", country_legal: "CH", sector_macro: "Intelligence Artificielle", description: "Modèles IA génératifs pour l'industrie pharmaceutique.", asr_score: 95, status: "verified", website: "https://synthetiq.ai" },
    { id: "s-006", display_name: "CyberShield Genève", entity_type: "company", country_legal: "CH", sector_macro: "Cybersécurité", description: "Protection avancée contre les cybermenaces pour entreprises.", asr_score: 92, status: "verified", website: "https://cybershield.ch" },
    { id: "s-007", display_name: "SwissData Hub", entity_type: "company", country_legal: "CH", sector_macro: "Data Center", description: "Centres de données certifiés ISO 27001 en Suisse.", asr_score: 93, status: "verified", website: "https://swissdatahub.ch" },
    { id: "s-008", display_name: "Appcraft Digital", entity_type: "company", country_legal: "FR", sector_macro: "Mobile Apps", description: "Création d'applications mobiles iOS et Android.", asr_score: 85, status: "verified", website: "https://appcraft.digital" },
    { id: "s-009", display_name: "CloudSafe Luxembourg", entity_type: "company", country_legal: "LU", sector_macro: "Cloud Souverain", description: "Hébergement cloud souverain conforme RGPD.", asr_score: 89, status: "verified", website: "https://cloudsafe.lu" },
    { id: "s-010", display_name: "DigiWave Bruxelles", entity_type: "company", country_legal: "BE", sector_macro: "Transformation Digitale", description: "Accompagnement à la transformation numérique des PME.", asr_score: 87, status: "verified", website: "https://digiwave.be" },

    // ── SANTÉ & BIEN-ÊTRE ──
    { id: "s-011", display_name: "MedConnect Suisse", entity_type: "company", country_legal: "CH", sector_macro: "HealthTech", description: "Télémédecine et suivi patient digital.", asr_score: 91, status: "verified", website: "https://medconnect.ch" },
    { id: "s-012", display_name: "Pharmagreen Labs", entity_type: "company", country_legal: "FR", sector_macro: "Pharmacie", description: "Laboratoire de compléments alimentaires bio certifiés.", asr_score: 87, status: "verified", website: "https://pharmagreen.fr" },
    { id: "s-013", display_name: "CareLink Santé", entity_type: "company", country_legal: "BE", sector_macro: "Soins à domicile", description: "Services de soins infirmiers et aide à domicile.", asr_score: 84, status: "verified", website: "https://carelink.be" },
    { id: "s-014", display_name: "NutriScience Europe", entity_type: "company", country_legal: "LU", sector_macro: "Nutrition", description: "Recherche et développement en nutrition sportive.", asr_score: 88, status: "verified", website: "https://nutriscience.lu" },
    { id: "s-015", display_name: "BioSense Lausanne", entity_type: "company", country_legal: "CH", sector_macro: "MedTech", description: "Dispositifs médicaux de diagnostic rapide.", asr_score: 92, status: "verified", website: "https://biosense-lausanne.ch" },
    { id: "s-016", display_name: "VitaNova Paris", entity_type: "company", country_legal: "FR", sector_macro: "Bien-être", description: "Centres de bien-être et médecine douce à Paris.", asr_score: 83, status: "verified", website: "https://vitanova-paris.fr" },

    // ── FINANCE & ASSURANCE ──
    { id: "s-017", display_name: "FinBridge Advisors", entity_type: "company", country_legal: "CH", sector_macro: "Finance", description: "Conseil en gestion de patrimoine et investissement durable.", asr_score: 90, status: "verified", website: "https://finbridge.ch" },
    { id: "s-018", display_name: "PaySecure France", entity_type: "company", country_legal: "FR", sector_macro: "FinTech", description: "Solutions de paiement sécurisé B2B.", asr_score: 93, status: "verified", website: "https://paysecure.fr" },
    { id: "s-019", display_name: "Assuria Groupe", entity_type: "company", country_legal: "FR", sector_macro: "Assurance", description: "Assurance santé et prévoyance pour les indépendants.", asr_score: 86, status: "verified", website: "https://assuria-groupe.fr" },
    { id: "s-020", display_name: "CryptoVault AG", entity_type: "company", country_legal: "CH", sector_macro: "Blockchain", description: "Custody et gestion d'actifs numériques réglementés.", asr_score: 91, status: "verified", website: "https://cryptovault.ch" },
    { id: "s-021", display_name: "TrustCapital Partners", entity_type: "company", country_legal: "LU", sector_macro: "Private Equity", description: "Fonds d'investissement en entreprises durables.", asr_score: 89, status: "verified", website: "https://trustcapital.lu" },
    { id: "s-022", display_name: "Mutuelle Santé Plus", entity_type: "company", country_legal: "FR", sector_macro: "Mutuelle Santé", description: "Complémentaire santé avec services de prévention.", asr_score: 85, status: "verified", website: "https://mutuelle-santeplus.fr" },
    { id: "s-023", display_name: "HelvetiCare Insurance", entity_type: "company", country_legal: "CH", sector_macro: "Assurance Maladie", description: "Assurance maladie et prévoyance suisse.", asr_score: 89, status: "verified", website: "https://helveticare.ch" },

    // ── ALIMENTATION & RESTAURATION ──
    { id: "s-024", display_name: "TerraBio Suisse", entity_type: "company", country_legal: "CH", sector_macro: "Agriculture Bio", description: "Production et distribution de produits bio en circuit court.", asr_score: 88, status: "verified", website: "https://terrabio.ch" },
    { id: "s-025", display_name: "La Table Verte", entity_type: "company", country_legal: "FR", sector_macro: "Restauration Durable", description: "Chaîne de restaurants 100% végétale et locale.", asr_score: 85, status: "verified", website: "https://latableverte.fr" },
    { id: "s-026", display_name: "Café Torréfaction Genève", entity_type: "company", country_legal: "CH", sector_macro: "Café & Torréfaction", description: "Torréfaction artisanale et sourcing éthique.", asr_score: 83, status: "verified", website: "https://cafe-geneve.ch" },
    { id: "s-027", display_name: "Fromagerie des Alpes", entity_type: "company", country_legal: "CH", sector_macro: "Produits Laitiers", description: "Fromagerie artisanale alpine certifiée AOP.", asr_score: 82, status: "verified", website: "https://fromagerie-alpes.ch" },
    { id: "s-028", display_name: "GourmetBox France", entity_type: "company", country_legal: "FR", sector_macro: "Food Box", description: "Box gastronomiques avec produits artisanaux français.", asr_score: 82, status: "verified", website: "https://gourmetbox.fr" },
    { id: "s-029", display_name: "Artisan Chocolatier Bruxelles", entity_type: "company", country_legal: "BE", sector_macro: "Chocolaterie", description: "Chocolats artisanaux belges, fèves équitables.", asr_score: 85, status: "verified", website: "https://artisan-chocolatier.be" },
    { id: "s-030", display_name: "Traiteur Maison Bordeaux", entity_type: "company", country_legal: "FR", sector_macro: "Traiteur", description: "Service traiteur haut de gamme pour événements.", asr_score: 81, status: "verified", website: "https://traiteur-bordeaux.fr" },
    { id: "s-031", display_name: "FreshBox Livraison", entity_type: "company", country_legal: "FR", sector_macro: "Logistique Alimentaire", description: "Livraison de paniers frais en température contrôlée.", asr_score: 86, status: "verified", website: "https://freshbox.fr" },

    // ── ÉDUCATION & FORMATION ──
    { id: "s-032", display_name: "LearnX Academy", entity_type: "company", country_legal: "FR", sector_macro: "EdTech", description: "Plateforme e-learning pour les métiers du digital.", asr_score: 89, status: "verified", website: "https://learnx.academy" },
    { id: "s-033", display_name: "Skills Factory Belgique", entity_type: "company", country_legal: "BE", sector_macro: "Formation Professionnelle", description: "Programmes de reconversion et upskilling.", asr_score: 87, status: "verified", website: "https://skillsfactory.be" },
    { id: "s-034", display_name: "CampusVR Suisse", entity_type: "company", country_legal: "CH", sector_macro: "Réalité Virtuelle Éducative", description: "Formation immersive en réalité virtuelle pour l'industrie.", asr_score: 91, status: "verified", website: "https://campusvr.ch" },
    { id: "s-035", display_name: "Lingua France", entity_type: "company", country_legal: "FR", sector_macro: "Langues", description: "Apprentissage de langues avec IA conversationnelle.", asr_score: 85, status: "verified", website: "https://linguafrance.fr" },

    // ── IMMOBILIER & CONSTRUCTION ──
    { id: "s-036", display_name: "EcoHabitat Suisse", entity_type: "company", country_legal: "CH", sector_macro: "Immobilier Durable", description: "Promotion immobilière écologique certifiée Minergie.", asr_score: 90, status: "verified", website: "https://ecohabitat.ch" },
    { id: "s-037", display_name: "BuildSmart Group", entity_type: "company", country_legal: "FR", sector_macro: "Construction", description: "Construction modulaire et bâtiments à énergie positive.", asr_score: 87, status: "verified", website: "https://buildsmart.fr" },
    { id: "s-038", display_name: "Rénovation Plus", entity_type: "company", country_legal: "BE", sector_macro: "Rénovation", description: "Rénovation énergétique pour particuliers et copropriétés.", asr_score: 82, status: "verified", website: "https://renovationplus.be" },
    { id: "s-039", display_name: "ImmoScan France", entity_type: "company", country_legal: "FR", sector_macro: "PropTech", description: "Visites virtuelles 3D et estimation immobilière IA.", asr_score: 88, status: "verified", website: "https://immoscan.fr" },

    // ── ÉNERGIE & ENVIRONNEMENT ──
    { id: "s-040", display_name: "SolarPeak Energy", entity_type: "company", country_legal: "CH", sector_macro: "Énergie Solaire", description: "Installation de panneaux solaires et stockage batteries.", asr_score: 93, status: "verified", website: "https://solarpeak.ch" },
    { id: "s-041", display_name: "AquaPure Technologies", entity_type: "company", country_legal: "FR", sector_macro: "Traitement de l'Eau", description: "Systèmes de purification d'eau innovants.", asr_score: 86, status: "verified", website: "https://aquapure.fr" },
    { id: "s-042", display_name: "EcoMetrics Consulting", entity_type: "company", country_legal: "CH", sector_macro: "ESG & RSE", description: "Audit et conseil en responsabilité environnementale.", asr_score: 90, status: "verified", website: "https://ecometrics.ch" },
    { id: "s-043", display_name: "GreenCycle Wallonie", entity_type: "company", country_legal: "BE", sector_macro: "Économie Circulaire", description: "Solutions de recyclage et valorisation des déchets.", asr_score: 88, status: "verified", website: "https://greencycle.be" },
    { id: "s-044", display_name: "Éoliennes de France", entity_type: "company", country_legal: "FR", sector_macro: "Énergie Éolienne", description: "Développement de parcs éoliens terrestres et offshore.", asr_score: 91, status: "verified", website: "https://eoliennes-france.fr" },
    { id: "s-045", display_name: "CleanTech Innovations", entity_type: "company", country_legal: "CH", sector_macro: "CleanTech", description: "Technologies propres pour l'industrie manufacturière.", asr_score: 91, status: "verified", website: "https://cleantech-innov.ch" },

    // ── TRANSPORT & MOBILITÉ ──
    { id: "s-046", display_name: "UrbanMove SA", entity_type: "company", country_legal: "CH", sector_macro: "Mobilité Urbaine", description: "Solutions de mobilité partagée et vélos électriques.", asr_score: 87, status: "verified", website: "https://urbanmove.ch" },
    { id: "s-047", display_name: "LogiTrans Express", entity_type: "company", country_legal: "FR", sector_macro: "Logistique", description: "Transport express et logistique du dernier kilomètre.", asr_score: 85, status: "verified", website: "https://logitrans.fr" },
    { id: "s-048", display_name: "FleetGreen France", entity_type: "company", country_legal: "FR", sector_macro: "Flotte Électrique", description: "Gestion de flottes de véhicules électriques pour entreprises.", asr_score: 89, status: "verified", website: "https://fleetgreen.fr" },
    { id: "s-049", display_name: "CargoFlex Belgique", entity_type: "company", country_legal: "BE", sector_macro: "Fret", description: "Logistique et transport de marchandises Benelux.", asr_score: 83, status: "verified", website: "https://cargoflex.be" },

    // ── LUXE & MODE ──
    { id: "s-050", display_name: "Maison Elara", entity_type: "company", country_legal: "FR", sector_macro: "Haute Couture", description: "Maison de couture parisienne, collections écoresponsables.", asr_score: 88, status: "verified", website: "https://maison-elara.fr" },
    { id: "s-051", display_name: "Chronocraft Genève", entity_type: "company", country_legal: "CH", sector_macro: "Horlogerie", description: "Manufacture horlogère suisse, mouvements mécaniques.", asr_score: 94, status: "verified", website: "https://chronocraft.ch" },
    { id: "s-052", display_name: "Joaillerie Montreux", entity_type: "company", country_legal: "CH", sector_macro: "Joaillerie", description: "Bijoux en or et pierres précieuses certifiées.", asr_score: 86, status: "verified", website: "https://joaillerie-montreux.ch" },
    { id: "s-053", display_name: "Atelier Cuir Lyon", entity_type: "company", country_legal: "FR", sector_macro: "Maroquinerie", description: "Maroquinerie artisanale de luxe, cuir tanné végétal.", asr_score: 85, status: "verified", website: "https://ateliercuir-lyon.fr" },
    { id: "s-054", display_name: "Tissu Noble Lyon", entity_type: "company", country_legal: "FR", sector_macro: "Textile de Luxe", description: "Soieries et tissus haut de gamme pour la haute couture.", asr_score: 86, status: "verified", website: "https://tissunoble.fr" },

    // ── INDUSTRIE & MANUFACTURING ──
    { id: "s-055", display_name: "PrecisionTech AG", entity_type: "company", country_legal: "CH", sector_macro: "Microtechnique", description: "Usinage de précision pour l'aéronautique et le médical.", asr_score: 93, status: "verified", website: "https://precisiontech.ch" },
    { id: "s-056", display_name: "Alpes Mécanique", entity_type: "company", country_legal: "FR", sector_macro: "Mécanique", description: "Sous-traitance industrielle et prototypage rapide.", asr_score: 84, status: "verified", website: "https://alpesmecanique.fr" },
    { id: "s-057", display_name: "NanoMat Solutions", entity_type: "company", country_legal: "CH", sector_macro: "Nanotechnologie", description: "Revêtements nanostructurés pour l'industrie.", asr_score: 90, status: "verified", website: "https://nanomat.ch" },
    { id: "s-058", display_name: "RoboTech Wallonie", entity_type: "company", country_legal: "BE", sector_macro: "Robotique Industrielle", description: "Intégration de robots collaboratifs en production.", asr_score: 88, status: "verified", website: "https://robotech-wallonie.be" },
    { id: "s-059", display_name: "Polymer Tech SA", entity_type: "company", country_legal: "CH", sector_macro: "Polymères", description: "Matériaux polymères avancés pour l'automobile.", asr_score: 89, status: "verified", website: "https://polymertech.ch" },

    // ── TOURISME & HÔTELLERIE ──
    { id: "s-060", display_name: "Alpine Retreats", entity_type: "company", country_legal: "CH", sector_macro: "Hôtellerie Premium", description: "Chalets et hôtels de luxe dans les Alpes suisses.", asr_score: 89, status: "verified", website: "https://alpineretreats.ch" },
    { id: "s-061", display_name: "Visit Provence Tours", entity_type: "company", country_legal: "FR", sector_macro: "Tourisme", description: "Circuits touristiques et expériences authentiques en Provence.", asr_score: 84, status: "verified", website: "https://visitprovence-tours.fr" },
    { id: "s-062", display_name: "Séjours Ardennes", entity_type: "company", country_legal: "BE", sector_macro: "Tourisme Vert", description: "Gîtes et hébergements nature dans les Ardennes belges.", asr_score: 82, status: "verified", website: "https://sejours-ardennes.be" },
    { id: "s-063", display_name: "Événements Riviera", entity_type: "company", country_legal: "CH", sector_macro: "Événementiel", description: "Organisation d'événements corporate sur la Riviera lémanique.", asr_score: 86, status: "verified", website: "https://evenements-riviera.ch" },
    { id: "s-064", display_name: "Hôtels de Charme Paris", entity_type: "company", country_legal: "FR", sector_macro: "Hôtellerie Boutique", description: "Collection d'hôtels boutique dans le Marais.", asr_score: 85, status: "verified", website: "https://hotels-charme-paris.fr" },

    // ── CONSEIL & SERVICES PRO ──
    { id: "s-065", display_name: "StratVision Consulting", entity_type: "company", country_legal: "CH", sector_macro: "Conseil Stratégique", description: "Conseil en transformation digitale pour grands comptes.", asr_score: 92, status: "verified", website: "https://stratvision.ch" },
    { id: "s-066", display_name: "LegalTech Partners", entity_type: "company", country_legal: "FR", sector_macro: "LegalTech", description: "Plateforme d'automatisation juridique et compliance.", asr_score: 88, status: "verified", website: "https://legaltech-partners.fr" },
    { id: "s-067", display_name: "TalentBridge RH", entity_type: "company", country_legal: "FR", sector_macro: "Ressources Humaines", description: "Recrutement et gestion des talents avec IA.", asr_score: 86, status: "verified", website: "https://talentbridge-rh.fr" },
    { id: "s-068", display_name: "AuditPro Genève", entity_type: "company", country_legal: "CH", sector_macro: "Audit & Comptabilité", description: "Cabinet d'audit et d'expertise comptable.", asr_score: 90, status: "verified", website: "https://auditpro.ch" },
    { id: "s-069", display_name: "MarketPulse Paris", entity_type: "company", country_legal: "FR", sector_macro: "Marketing Digital", description: "Agence de marketing digital et growth hacking.", asr_score: 87, status: "verified", website: "https://marketpulse.fr" },
    { id: "s-070", display_name: "TransGlobal Traduction", entity_type: "company", country_legal: "BE", sector_macro: "Traduction", description: "Services de traduction professionnelle multilingue.", asr_score: 83, status: "verified", website: "https://transglobal.be" },

    // ── CULTURE & MÉDIA ──
    { id: "s-071", display_name: "Studio Lumière", entity_type: "company", country_legal: "FR", sector_macro: "Production Audiovisuelle", description: "Production de films publicitaires et documentaires.", asr_score: 85, status: "verified", website: "https://studiolumiere.fr" },
    { id: "s-072", display_name: "PressTech Media", entity_type: "company", country_legal: "CH", sector_macro: "Média Digital", description: "Plateforme médiatique B2B pour la tech.", asr_score: 86, status: "verified", website: "https://presstech.media" },
    { id: "s-073", display_name: "Galerie Art Contemporain", entity_type: "company", country_legal: "FR", sector_macro: "Art & Culture", description: "Galerie d'art contemporain à Lyon.", asr_score: 82, status: "verified", website: "https://galerie-artcontemporain.fr" },
    { id: "s-074", display_name: "VR Experience Lab", entity_type: "company", country_legal: "FR", sector_macro: "Réalité Virtuelle", description: "Centres d'expériences immersives en réalité virtuelle.", asr_score: 83, status: "verified", website: "https://vrexperience.fr" },

    // ── ASSOCIATIONS & ONG ──
    { id: "s-075", display_name: "Fondation Espoir Vert", entity_type: "association", country_legal: "CH", sector_macro: "Environnement", description: "Protection des écosystèmes alpins et reforestation.", asr_score: 87, status: "verified", website: "https://espoir-vert.ch" },
    { id: "s-076", display_name: "Réseau Solidaire France", entity_type: "association", country_legal: "FR", sector_macro: "Action Sociale", description: "Aide alimentaire et insertion professionnelle.", asr_score: 84, status: "verified", website: "https://reseau-solidaire.fr" },
    { id: "s-077", display_name: "Tech4Good Belgique", entity_type: "association", country_legal: "BE", sector_macro: "Tech for Good", description: "Promotion de la technologie au service de l'inclusion.", asr_score: 89, status: "verified", website: "https://tech4good.be" },
    { id: "s-078", display_name: "Jeunesse Active Francophone", entity_type: "association", country_legal: "BE", sector_macro: "Jeunesse", description: "Programmes d'échange et formation pour jeunes francophones.", asr_score: 81, status: "verified", website: "https://jeunesse-active.be" },
    { id: "s-079", display_name: "Fondation Numérique Solidaire", entity_type: "association", country_legal: "FR", sector_macro: "Inclusion Numérique", description: "Lutte contre la fracture numérique et formation.", asr_score: 83, status: "verified", website: "https://numerique-solidaire.fr" },

    // ── SPORT & LOISIRS ──
    { id: "s-080", display_name: "Summit Sports Academy", entity_type: "company", country_legal: "CH", sector_macro: "Sport", description: "Académie de sports alpins et préparation physique.", asr_score: 85, status: "verified", website: "https://summitsports.ch" },
    { id: "s-081", display_name: "FitTech Solutions", entity_type: "company", country_legal: "FR", sector_macro: "FitTech", description: "Appareils connectés et coaching sportif intelligent.", asr_score: 87, status: "verified", website: "https://fittech.fr" },
    { id: "s-082", display_name: "Outdoor Alpes", entity_type: "company", country_legal: "FR", sector_macro: "Outdoor", description: "Équipement outdoor durable pour la montagne.", asr_score: 83, status: "verified", website: "https://outdoor-alpes.fr" },

    // ── BEAUTÉ & COSMÉTIQUE ──
    { id: "s-083", display_name: "Pure Botanics", entity_type: "company", country_legal: "FR", sector_macro: "Cosmétique Bio", description: "Cosmétiques naturels certifiés Cosmos Organic.", asr_score: 86, status: "verified", website: "https://purebotanics.fr" },
    { id: "s-084", display_name: "SwissBeauty Lab", entity_type: "company", country_legal: "CH", sector_macro: "Cosmétique Premium", description: "Soins de la peau anti-âge à base d'ingrédients suisses.", asr_score: 88, status: "verified", website: "https://swissbeautylab.ch" },
    { id: "s-085", display_name: "Parfumerie Artisanale Grasse", entity_type: "company", country_legal: "FR", sector_macro: "Parfumerie", description: "Parfums artisanaux et huiles essentielles de Grasse.", asr_score: 84, status: "verified", website: "https://parfumerie-grasse.fr" },

    // ── JURIDIQUE ──
    { id: "s-086", display_name: "Cabinet Duval & Associés", entity_type: "company", country_legal: "FR", sector_macro: "Droit des Affaires", description: "Cabinet d'avocats spécialisé en droit commercial.", asr_score: 88, status: "verified", website: "https://duval-associes.fr" },
    { id: "s-087", display_name: "IP Shield Law", entity_type: "company", country_legal: "CH", sector_macro: "Propriété Intellectuelle", description: "Protection de brevets et marques à l'international.", asr_score: 91, status: "verified", website: "https://ipshield.law" },
    { id: "s-088", display_name: "Étude Notariale Lambert", entity_type: "company", country_legal: "FR", sector_macro: "Notariat", description: "Étude notariale spécialisée en immobilier et succession.", asr_score: 82, status: "verified", website: "https://notaire-lambert.fr" },

    // ── ARCHITECTURE & DESIGN ──
    { id: "s-089", display_name: "Atelier Horizon", entity_type: "company", country_legal: "CH", sector_macro: "Architecture", description: "Cabinet d'architecture durable et bioclimatique.", asr_score: 89, status: "verified", website: "https://atelier-horizon.ch" },
    { id: "s-090", display_name: "Paysages Urbains", entity_type: "company", country_legal: "FR", sector_macro: "Paysagisme", description: "Architecture paysagère et espaces verts urbains.", asr_score: 83, status: "verified", website: "https://paysages-urbains.fr" },
    { id: "s-091", display_name: "Design Intérieur Bruxelles", entity_type: "company", country_legal: "BE", sector_macro: "Design Intérieur", description: "Décoration et aménagement d'espaces professionnels.", asr_score: 85, status: "verified", website: "https://design-interieur.be" },

    // ── AUTOMOBILE ──
    { id: "s-092", display_name: "ElectraDrive Suisse", entity_type: "company", country_legal: "CH", sector_macro: "Véhicules Électriques", description: "Conversion de véhicules thermiques en électriques.", asr_score: 88, status: "verified", website: "https://electradrive.ch" },
    { id: "s-093", display_name: "AutoTech Diagnostics", entity_type: "company", country_legal: "FR", sector_macro: "Automobile", description: "Solutions de diagnostic et maintenance prédictive.", asr_score: 85, status: "verified", website: "https://autotech-diag.fr" },

    // ── AGRICULTURE & VITICULTURE ──
    { id: "s-094", display_name: "Domaine du Lac Léman", entity_type: "company", country_legal: "CH", sector_macro: "Viticulture", description: "Vignoble en terrasses, vins AOC Lavaux.", asr_score: 87, status: "verified", website: "https://domaine-lacleman.ch" },
    { id: "s-095", display_name: "AgriSmart Technologies", entity_type: "company", country_legal: "FR", sector_macro: "AgriTech", description: "Agriculture de précision et capteurs IoT.", asr_score: 89, status: "verified", website: "https://agrismart.tech" },
    { id: "s-096", display_name: "Vignobles de Bourgogne", entity_type: "company", country_legal: "FR", sector_macro: "Viticulture", description: "Domaine viticole bio en Côte-d'Or.", asr_score: 84, status: "verified", website: "https://vignobles-bourgogne.fr" },

    // ── NAUTISME ──
    { id: "s-097", display_name: "Azur Marine Services", entity_type: "company", country_legal: "FR", sector_macro: "Nautisme", description: "Maintenance et hivernage de yachts en Méditerranée.", asr_score: 84, status: "verified", website: "https://azurmarine.fr" },

    // ── AÉROSPATIAL ──
    { id: "s-098", display_name: "SkyTech Avionics", entity_type: "company", country_legal: "FR", sector_macro: "Avionique", description: "Systèmes avioniques et navigation pour drones.", asr_score: 92, status: "verified", website: "https://skytech-avionics.fr" },
    { id: "s-099", display_name: "SpaceReach Zurich", entity_type: "company", country_legal: "CH", sector_macro: "NewSpace", description: "Micro-satellites et solutions d'observation terrestre.", asr_score: 94, status: "verified", website: "https://spacereach.ch" },

    // ── TÉLÉCOMS ──
    { id: "s-100", display_name: "FibreConnect France", entity_type: "company", country_legal: "FR", sector_macro: "Télécommunications", description: "Déploiement de réseaux fibre optique en France.", asr_score: 87, status: "verified", website: "https://fibreconnect.fr" },
    { id: "s-101", display_name: "5G Solutions Suisse", entity_type: "company", country_legal: "CH", sector_macro: "5G & IoT", description: "Infrastructure 5G et réseaux IoT privés.", asr_score: 90, status: "verified", website: "https://5gsolutions.ch" },

    // ── RETAIL & E-COMMERCE ──
    { id: "s-102", display_name: "ShopLocal France", entity_type: "company", country_legal: "FR", sector_macro: "E-Commerce Local", description: "Marketplace pour commerces de proximité.", asr_score: 84, status: "verified", website: "https://shoplocal.fr" },
    { id: "s-103", display_name: "LuxeBox Zurich", entity_type: "company", country_legal: "CH", sector_macro: "E-Commerce Premium", description: "Box d'abonnement de produits suisses haut de gamme.", asr_score: 86, status: "verified", website: "https://luxebox.ch" },
    { id: "s-104", display_name: "GreenMarket Belgique", entity_type: "company", country_legal: "BE", sector_macro: "Commerce Durable", description: "Vente en ligne de produits éco-responsables.", asr_score: 83, status: "verified", website: "https://greenmarket.be" },

    // ── SERVICES PUBLICS ──
    { id: "s-105", display_name: "Ville de Nyon", entity_type: "public_body", country_legal: "CH", sector_macro: "Administration Publique", description: "Commune suisse engagée dans la transition numérique.", asr_score: 82, status: "verified", website: "https://nyon.ch" },
    { id: "s-106", display_name: "Communauté de Communes Vaucluse", entity_type: "public_body", country_legal: "FR", sector_macro: "Collectivité Territoriale", description: "Services publics et développement territorial.", asr_score: 79, status: "verified", website: "https://cc-vaucluse.fr" },

    // ── PHARMA & BIOTECH ──
    { id: "s-107", display_name: "GeneSys Biotech", entity_type: "company", country_legal: "CH", sector_macro: "Biotechnologie", description: "Thérapies géniques et médecine personnalisée.", asr_score: 95, status: "verified", website: "https://genesys-biotech.ch" },
    { id: "s-108", display_name: "BioPharma Lyon", entity_type: "company", country_legal: "FR", sector_macro: "Pharma", description: "Développement de traitements par thérapie cellulaire.", asr_score: 93, status: "verified", website: "https://biopharma-lyon.fr" },
    { id: "s-109", display_name: "NutraSanté Belgique", entity_type: "company", country_legal: "BE", sector_macro: "Compléments Nutritionnels", description: "Compléments alimentaires bio et naturels.", asr_score: 86, status: "verified", website: "https://nutrasante.be" },

    // ── SÉCURITÉ ──
    { id: "s-110", display_name: "SecureGuard Systems", entity_type: "company", country_legal: "CH", sector_macro: "Sécurité", description: "Systèmes de surveillance et contrôle d'accès.", asr_score: 88, status: "verified", website: "https://secureguard.ch" },
    { id: "s-111", display_name: "IncendiProtect France", entity_type: "company", country_legal: "FR", sector_macro: "Sécurité Incendie", description: "Solutions de détection et prévention incendie.", asr_score: 85, status: "verified", website: "https://incendiprotect.fr" },

    // ── CHIMIE ──
    { id: "s-112", display_name: "ChimieVerte Lyon", entity_type: "company", country_legal: "FR", sector_macro: "Chimie Fine", description: "Chimie de spécialité pour l'industrie cosmétique.", asr_score: 87, status: "verified", website: "https://chimieverte.fr" },

    // ── BIEN-ÊTRE ANIMAL ──
    { id: "s-113", display_name: "PetCare Premium", entity_type: "company", country_legal: "FR", sector_macro: "Animalerie", description: "Alimentation premium et soins naturels pour animaux.", asr_score: 82, status: "verified", website: "https://petcare-premium.fr" },
    { id: "s-114", display_name: "VetClinic Connect", entity_type: "company", country_legal: "BE", sector_macro: "Vétérinaire", description: "Réseau de cliniques vétérinaires connectées.", asr_score: 84, status: "verified", website: "https://vetclinic-connect.be" },

    // ── ÉDITION & IMPRESSION ──
    { id: "s-115", display_name: "PrintEco Solutions", entity_type: "company", country_legal: "FR", sector_macro: "Imprimerie Verte", description: "Impression écologique avec encres végétales.", asr_score: 81, status: "verified", website: "https://printeco.fr" },
    { id: "s-116", display_name: "Éditions Numériques Suisse", entity_type: "company", country_legal: "CH", sector_macro: "Édition Numérique", description: "Plateforme d'édition et publication digitale.", asr_score: 83, status: "verified", website: "https://editions-numeriques.ch" },

    // ── COWORKING & ESPACES ──
    { id: "s-117", display_name: "HubSpace Lausanne", entity_type: "company", country_legal: "CH", sector_macro: "Coworking", description: "Espaces de coworking et incubateur de startups.", asr_score: 85, status: "verified", website: "https://hubspace-lausanne.ch" },
    { id: "s-118", display_name: "Le Loft Coworking", entity_type: "company", country_legal: "FR", sector_macro: "Coworking", description: "Espaces de travail partagés au coeur de Marseille.", asr_score: 82, status: "verified", website: "https://leloft-coworking.fr" },

    // ── SERVICES INFORMATIQUES ──
    { id: "s-119", display_name: "ITServ Pro", entity_type: "company", country_legal: "FR", sector_macro: "Infogérance", description: "Services d'infogérance et support IT 24/7.", asr_score: 86, status: "verified", website: "https://itserv-pro.fr" },
    { id: "s-120", display_name: "DevOps Suisse", entity_type: "company", country_legal: "CH", sector_macro: "DevOps", description: "Conseil et automatisation DevOps & CI/CD.", asr_score: 90, status: "verified", website: "https://devops-suisse.ch" },

    // ── CERTIFICATION & QUALITÉ ──
    { id: "s-121", display_name: "SwissQuality Cert", entity_type: "company", country_legal: "CH", sector_macro: "Certification", description: "Organisme de certification ISO et qualité suisse.", asr_score: 93, status: "verified", website: "https://swissquality.ch" },

    // ── DOMOTIQUE ──
    { id: "s-122", display_name: "SmartHome France", entity_type: "company", country_legal: "FR", sector_macro: "Domotique", description: "Solutions domotiques et maison intelligente.", asr_score: 87, status: "verified", website: "https://smarthome-france.fr" },

    // ── EMBALLAGE ──
    { id: "s-123", display_name: "EcoPackaging Suisse", entity_type: "company", country_legal: "CH", sector_macro: "Emballage Durable", description: "Emballages biodégradables et compostables.", asr_score: 84, status: "verified", website: "https://ecopackaging.ch" },

    // ── JEUX VIDÉO ──
    { id: "s-124", display_name: "Pixel Realm Studios", entity_type: "company", country_legal: "FR", sector_macro: "Jeux Vidéo", description: "Studio de développement de jeux indie primés.", asr_score: 85, status: "verified", website: "https://pixelrealm.fr" },

    // ── SANTÉ DIGITALE ──
    { id: "s-125", display_name: "eSanté Luxembourg", entity_type: "company", country_legal: "LU", sector_macro: "HealthTech", description: "Applications de suivi de santé et bien-être.", asr_score: 85, status: "verified", website: "https://esante.lu" },

    // ── CONSEIL RSE ──
    { id: "s-126", display_name: "Impact Positif Conseil", entity_type: "company", country_legal: "FR", sector_macro: "RSE & Impact", description: "Accompagnement des entreprises dans leur démarche RSE.", asr_score: 88, status: "verified", website: "https://impact-positif.fr" },
    { id: "s-127", display_name: "GreenScore Suisse", entity_type: "company", country_legal: "CH", sector_macro: "Notation ESG", description: "Notation extra-financière et reporting ESG.", asr_score: 91, status: "verified", website: "https://greenscore.ch" },

    // ── GASTRONOMIE ──
    { id: "s-128", display_name: "Chef à Domicile Paris", entity_type: "company", country_legal: "FR", sector_macro: "Gastronomie", description: "Service de chef privé et cours de cuisine à domicile.", asr_score: 80, status: "verified", website: "https://chef-domicile-paris.fr" },
    { id: "s-129", display_name: "Boulangerie Artisanale Genève", entity_type: "company", country_legal: "CH", sector_macro: "Boulangerie", description: "Boulangerie artisanale bio au levain naturel.", asr_score: 81, status: "verified", website: "https://boulangerie-geneve.ch" },
    { id: "s-130", display_name: "Caves de Bordeaux", entity_type: "company", country_legal: "FR", sector_macro: "Oenologie", description: "Cave à vins et conseil en oenologie.", asr_score: 83, status: "verified", website: "https://caves-bordeaux.fr" },
];

export default function AyaPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]); // Start empty
    const [loading, setLoading] = useState(true);

    // CONNEXION BACKEND RÉEL + SEED DATA
    useEffect(() => {
        setLoading(true);
        fetch('/api/aya/live')
            .then(res => res.json())
            .then(apiRes => {
                if (apiRes.success && apiRes.data && Array.isArray(apiRes.data)) {
                    console.log(`🔥 AYA LIVE: Loading ${apiRes.data.length} real entities from Firestore`);
                    // Merge: real entities first (by URL dedup), then seed data
                    const realUrls = new Set(apiRes.data.map((e: any) => (e.website || '').toLowerCase().replace(/\/$/, '')));
                    const filteredSeed = SEED_ENTITIES.filter(s => !realUrls.has((s.website || '').toLowerCase().replace(/\/$/, '')));
                    setResults([...apiRes.data, ...filteredSeed]);
                } else {
                    setResults([...SEED_ENTITIES]);
                }
            })
            .catch(err => {
                console.warn("⚠️ AYA Backend connectivity issue.", err);
                setResults([...SEED_ENTITIES]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Filtrage par recherche + limitation à 6 par défaut
    const filteredResults = results.filter((ent: any) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
            (ent.name && ent.name.toLowerCase().includes(q)) ||
            (ent.display_name && ent.display_name.toLowerCase().includes(q)) ||
            (ent.description && ent.description.toLowerCase().includes(q)) ||
            (ent.website && ent.website.toLowerCase().includes(q)) ||
            (ent.sector && ent.sector.toLowerCase().includes(q)) ||
            (ent.country && ent.country.toLowerCase().includes(q))
        );
    });
    const isSearching = query.length > 0;
    const displayedResults = isSearching ? filteredResults : filteredResults.slice(0, 6);

    return (
        <div style={{ background: 'var(--bg-main)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>

            {/* HEADER */}
            <header style={{ background: 'white', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, zIndex: 100, padding: '15px 0' }}>
                <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none' }}>
                        <img src="/logo-v2.png" alt="AI Visionary" style={{ height: '40px', width: 'auto' }} />
                        <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }}></div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                            REGISTRE <span style={{ color: 'var(--primary-color)', fontWeight: '400' }}>AYA</span>
                        </span>
                    </Link>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                            Inscrire mon entité
                        </Link>
                    </div>
                </div>
            </header>

            {/* HERO SECTION */}
            <section className="section" style={{ textAlign: 'center', paddingBottom: '3rem' }}>
                <div className="container">
                    <span style={{ display: 'inline-block', padding: '5px 15px', borderRadius: '20px', background: 'var(--bg-accent)', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>
                        Réseau de Confiance Certifié
                    </span>
                    <h1 className="headline" style={{ fontSize: '3.5rem', marginBottom: '20px', maxWidth: '900px', margin: '0 auto 20px' }}>
                        Devenez l'entreprise que l'IA recommande en priorité.
                    </h1>
                    <p className="subheadline" style={{ maxWidth: '700px', margin: '0 auto' }}>
                        Rendez votre entreprise visible pour les millions d'utilisateurs qui posent des questions à l'IA chaque jour (ChatGPT, Gemini, Claude, Mistral, Llama, Ernie...).
                    </p>

                    {/* SEARCH BAR */}
                    <div style={{ maxWidth: '600px', margin: '40px auto 0', position: 'relative' }}>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher une entreprise (ex: 'Nexora', 'Éclore', 'MedConnect')..."
                            style={{
                                width: '100%',
                                padding: '18px 25px',
                                borderRadius: '50px',
                                border: '1px solid var(--border-light)',
                                fontSize: '1.1rem',
                                boxShadow: 'var(--shadow-md)',
                                outline: 'none',
                                color: 'var(--text-main)'
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* RESULTS LIST */}
            <section className="section" style={{ background: 'white', borderTop: '1px solid var(--border-light)' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                        <div>
                            <h2 className="section-title" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Dernières Certifications en temps réel</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Ces entreprises viennent d'obtenir leur validité ASR pour être citées par les Agents IA.</p>
                        </div>
                        <div style={{ background: 'var(--bg-accent)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                            {loading ? 'Chargement...' : `${results.length} Entreprises enregistrées`}
                        </div>
                    </div>

                    <div className="grid-3" style={{ rowGap: '30px' }}>
                        {loading ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>Loading...</div>
                        ) : displayedResults.length > 0 ? (
                            displayedResults.map((entity) => (
                                <div key={entity.id || entity.aya_entity_id} className="card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <span style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                            {(entity.country || entity.country_legal || 'XX').toUpperCase().slice(0, 2)} • {
                                                ({ 'company': 'Entreprise', 'association': 'Association', 'public_body': 'Organisme Public', 'individual': 'Indépendant' } as Record<string, string>)[entity.type || entity.entity_type] || 'Organisation'
                                            }
                                        </span>
                                        {(entity.status === 'verified' || entity.recommendability?.status === 'fresh') && (
                                            <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                ✓ ASR VALIDÉ
                                            </span>
                                        )}
                                    </div>

                                    <Link href={`/aya/e/${entity.id || entity.aya_entity_id}`} style={{ textDecoration: 'none' }}>
                                        <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', color: 'var(--text-main)', cursor: 'pointer' }}>
                                            {entity.display_name || entity.legal_name || entity.name || "Entite certifiee"}
                                        </h3>
                                    </Link>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.5', flex: 1 }}>{entity.description || "Identité Sémantique optimisée pour les IAs."}</p>

                                    <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '-0.5px' }}>
                                                ID: aya:{(entity.country || entity.country_legal || 'xx').toLowerCase()}:{(entity.id || entity.aya_entity_id).slice(0, 8)}...
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)', lineHeight: 1 }}>{entity.asr_score || Math.round((entity.recommendability?.freshness_score || 0.99) * 100)}%</span>
                                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Trust Score</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', background: 'var(--bg-main)', borderRadius: '16px', border: '1px dashed var(--border-light)' }}>
                                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Aucun résultat pour "{query}".</p>
                                <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary">
                                    Inscrire mon entreprise
                                </Link>
                            </div>
                        )}
                    </div>

                </div>
            </section>

            {/* CTA SECTION */}
            <section className="section" style={{ background: 'var(--text-main)', color: 'white', textAlign: 'center' }}>
                <div className="container">
                    <h2 style={{ color: 'white', marginBottom: '20px' }}>Prenez le contrôle de votre image IA.</h2>
                    <p className="subheadline" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '40px' }}>
                        Rejoignez le registre officiel et assurez-vous que tous les Agents IA parlent de vous correctement.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <Link href="/diagnostic?pack=aya-sub" className="btn" style={{ background: 'white', color: 'var(--text-main)' }}>
                            S'abonner au Registre (19 CHF/mois)
                        </Link>
                        <Link href="/diagnostic" className="btn" style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}>
                            Faire un Audit Gratuit
                        </Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="footer" style={{ background: 'var(--text-main)', color: 'white', padding: '40px 0', textAlign: 'center' }}>
                <div className="container">
                    <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.9rem', fontWeight: '500' }}>Registre AYA v1.0 • Powered by AI Visionary</p>
                </div>
            </footer>
        </div>
    );
}
