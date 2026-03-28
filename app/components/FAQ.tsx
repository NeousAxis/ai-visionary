"use client";

import React, { useState } from 'react';

const FaqItem = ({ question, children }: { question: string, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="faq-item" style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '10px',
            overflow: 'hidden'
        }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '1.5rem 1rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-heading)'
                }}
            >
                <span>{question}</span>
                <span style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    fontSize: '1.2rem',
                    color: 'var(--primary-color)'
                }}>
                    ↓
                </span>
            </button>
            <div style={{
                height: isOpen ? 'auto' : '0',
                padding: isOpen ? '0 1rem 1.5rem 1rem' : '0 1rem',
                opacity: isOpen ? 1 : 0,
                transition: 'all 0.3s ease',
                color: 'var(--text-muted)',
                lineHeight: '1.6'
            }}>
                {children}
            </div>
        </div>
    );
};

export default function FAQ() {
    return (
        <section id="faq" className="section faq-section" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="container" style={{ maxWidth: '800px' }}>
                <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    FAQ — Comment AI-VISIONARY rend votre entreprise compréhensible par les IA
                </h2>

                <FaqItem question="1. Pourquoi les IA se trompent-elles souvent quand elles parlent des entreprises ?">
                    <p><strong>Parce que la majorité des sites sont écrits pour des humains, pas pour des IA.</strong></p>
                    <ul style={{ margin: '1rem 0', paddingLeft: '1.5rem' }}>
                        <li>Les IA lisent des récits, des valeurs, des formulations ambiguës, des promesses implicites.</li>
                        <li>Elles doivent alors interpréter, compléter, ou deviner.</li>
                    </ul>
                    <p>C’est là que naissent les erreurs, les approximations, ou les silences prudents.</p>
                    <p style={{ marginTop: '1rem', color: 'var(--text-main)', fontWeight: '600' }}>AI-VISIONARY part d’un principe simple :<br />👉 Une IA ne devrait jamais avoir à deviner ce qu’est une entreprise.</p>
                </FaqItem>

                <FaqItem question="2. Qu’est-ce que fait concrètement AYO ?">
                    <p><strong>AYO crée un ASR — AI Singular Record.</strong></p>
                    <p style={{ marginTop: '0.5rem' }}>Un ASR est une déclaration officielle et structurée de votre entreprise : ce que vous êtes, ce que vous faites, et ce que vous ne déclarez pas.</p>
                    <ul style={{ margin: '1rem 0', paddingLeft: '1.5rem' }}>
                        <li>Ce n’est ni du SEO,</li>
                        <li>ni un texte marketing,</li>
                        <li>ni un classement.</li>
                    </ul>
                    <p>C’est un point de référence stable, lisible par les IA, qui réduit drastiquement le risque d’hallucination.</p>
                </FaqItem>

                <FaqItem question="3. Pourquoi l’ASR est-il scellé cryptographiquement ?">
                    <p><strong>Parce qu’une déclaration n’a de valeur que si elle est stable.</strong></p>
                    <p style={{ marginTop: '0.5rem' }}>Le scellement cryptographique garantit que :</p>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>L’ASR n’a pas été modifié,</li>
                        <li>Il correspond à une version précise,</li>
                        <li>Il provient bien de l’autorité AI-VISIONARY.</li>
                    </ul>
                    <p style={{ marginTop: '1rem', color: 'var(--text-main)' }}>👉 Le sceau ne “certifie pas la qualité” de l’entreprise.<br />👉 Il empêche simplement l’altération et l’ambiguïté.</p>
                    <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>Pour une IA, cela transforme un texte incertain en source fiable.</p>
                </FaqItem>

                <FaqItem question="4. Quel est le rôle exact de AYA par rapport à AYO ?">
                    <p><strong>AYA est une base de données consultable, comparable à un moteur de recherche, mais avec une différence fondamentale :</strong></p>
                    <p style={{ color: 'var(--primary-color)', margin: '0.5rem 0' }}>👉 Ce n’est pas la popularité qui permet de trouver une entreprise, mais la manière dont ses données sont structurées.</p>

                    <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>AYO intervient en amont :</p>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>Il structure les informations d’une entreprise,</li>
                        <li>Il les rend explicites et non ambiguës,</li>
                        <li>Il produit un ASR lisible par les IA.</li>
                    </ul>

                    <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>AYA intervient en aval :</p>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>Il indexe ces données structurées,</li>
                        <li>Il permet de les interroger par contenu réel, pas par mots-clés vagues,</li>
                        <li>Il ne classe pas “les meilleurs” et ne recommande pas.</li>
                    </ul>

                    <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>Concrètement, AYA permet de trouver des entreprises qui déclarent exactement ce que vous cherchez, parce que leurs données sont structurées de manière comparable, et non parce qu’elles sont connues.</p>
                </FaqItem>

                <FaqItem question="5. Est-ce que cela garantit que mon entreprise sera citée par les IA ?">
                    <p><strong>Non. Et toute promesse inverse serait trompeuse.</strong></p>
                    <p>AI-VISIONARY ne garantit : ni trafic, ni recommandation, ni visibilité automatique.</p>

                    <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>Ce qu’il garantit, en revanche, c’est ceci :</p>
                    <p>Votre entreprise devient mentionnable par une IA, parce qu’elle est claire, bornée et non ambiguë.</p>
                    <p style={{ marginTop: '0.5rem', color: 'var(--text-main)' }}>Les IA citent ce qu’elles peuvent comprendre sans se tromper, pas ce qui crie le plus fort.</p>
                </FaqItem>

                <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.1rem', fontStyle: 'italic', fontWeight: '600' }}>
                        "AI-VISIONARY ne rend pas les entreprises populaires.<br />
                        Il les rend compréhensibles par les intelligences artificielles."
                    </p>
                </div>

            </div>
        </section>
    );
}
