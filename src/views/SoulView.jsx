// ⬡B:MACE.view:CIP:SoulView:20260413⬡
// SOUL Spiritual App — CIP (MyABA) View
// Imports everything from soul-core.js (shared core)

import React, { useState, useEffect, useCallback } from 'react';
import {
  useRoutine, useQuiz, useSermonNotes,
  SECTION_NAMES, SECTION_TITLES, SECTION_EMOJIS,
  formatDate, getTodayDate, generateChangelog
} from '../utils/soul-core.js';

const API_BASE = import.meta.env.VITE_API_URL || 'https://abacia-services.onrender.com';
const api = async (path, opts = {}) => {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {})
  });
  return resp.json();
};

export default function SoulView({ userId = 'brandon' }) {
  const [tab, setTab] = useState('routine'); // routine, quiz, sermon, names
  const {
    routine, loading, error, currentSection, completedSections,
    loadRoutine, completeSection, nextSection, prevSection, setCurrentSection, progress
  } = useRoutine(api, userId);
  const { questions, answers, results, quizLoading, startQuiz, setAnswer, submitQuiz } = useQuiz(api);
  const { sermonData, saving, saved, updateField, saveNotes, reset } = useSermonNotes(api, userId);
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  useEffect(() => { if (tab === 'routine' && !routine) loadRoutine(getTodayDate()); }, [tab]);

  const sectionKey = routine ? SECTION_NAMES[currentSection] : null;
  const section = routine?.sections?.[sectionKey];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #24243e 100%)', color: '#e8e0f0', fontFamily: "'DM Sans', sans-serif", padding: '16px', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(90deg, #f5d99a, #c4a265)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SOUL</div>
        <div style={{ fontSize: 12, color: '#a89cc8', letterSpacing: 2, marginTop: 4 }}>SPIRITUAL OVERSIGHT &amp; UNDERSTANDING</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderRadius: 12, background: 'rgba(255,255,255,0.06)', padding: 4 }}>
        {[['routine','Daily'], ['quiz','Quiz'], ['sermon','Sermon'], ['names','Names']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === key ? 'linear-gradient(135deg, #c4a265, #f5d99a)' : 'transparent',
            color: tab === key ? '#1a1040' : '#a89cc8', transition: 'all 0.2s'
          }}>{label}</button>
        ))}
      </div>

      {/* ROUTINE TAB */}
      {tab === 'routine' && (
        <div>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#c4a265' }}>Preparing your routine...</div>}
          {error && <div style={{ textAlign: 'center', padding: 20, color: '#ef4444' }}>{error}</div>}

          {routine && (
            <>
              {/* Date + Progress */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f5d99a' }}>{formatDate(routine.date)}</div>
                <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #c4a265, #f5d99a)', borderRadius: 20, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 11, color: '#a89cc8', marginTop: 4 }}>{progress}% complete</div>
              </div>

              {/* Section Navigation Pills */}
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
                {SECTION_NAMES.map((name, i) => (
                  <button key={name} onClick={() => setCurrentSection(i)} style={{
                    minWidth: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 14,
                    background: currentSection === i ? '#c4a265' : completedSections.has(name) ? 'rgba(196,162,101,0.3)' : 'rgba(255,255,255,0.08)',
                    color: currentSection === i ? '#1a1040' : '#e8e0f0', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{SECTION_EMOJIS[name]}</button>
                ))}
              </div>

              {/* Current Section */}
              {section && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f5d99a', marginBottom: 12 }}>
                    {SECTION_EMOJIS[sectionKey]} {SECTION_TITLES[sectionKey]}
                  </div>

                  {/* Morning Greetings */}
                  {sectionKey === 'morningGreetings' && section.content?.map((g, i) => (
                    <div key={i} style={{ padding: '12px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{g.greeting}</div>
                      <div style={{ fontSize: 13, color: '#a89cc8' }}>{g.subtitle}</div>
                    </div>
                  ))}

                  {/* Names of God Study */}
                  {sectionKey === 'namesOfGod' && (
                    <>
                      <div style={{ fontSize: 13, color: '#a89cc8', marginBottom: 12 }}>{section.instructions}</div>
                      {section.names?.map((n, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 10, borderLeft: `3px solid ${n.type === 'lesser-known' ? '#c4a265' : '#8b5cf6'}` }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>Name {n.number}: {n.name}</div>
                          <div style={{ fontSize: 13, color: '#a89cc8' }}>Pronunciation: {n.pronunciation}</div>
                          <div style={{ fontSize: 13, color: '#a89cc8' }}>Scripture: {n.scripture}</div>
                          <div style={{ fontSize: 13, color: '#c8c0d8', marginTop: 6 }}>{n.context}</div>
                          {n.meaning && <div style={{ fontSize: 14, color: '#22c55e', marginTop: 6 }}>Meaning: {n.meaning} ✓</div>}
                          {!n.meaning && <div style={{ fontSize: 14, color: '#f5d99a', marginTop: 6 }}>Your Guess: ________________</div>}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Scripture Memory */}
                  {sectionKey === 'scriptureMemory' && (
                    <div style={{ padding: 16, background: 'rgba(196,162,101,0.1)', borderRadius: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f5d99a', marginBottom: 8 }}>{section.reference}</div>
                      <div style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.6, color: '#e8e0f0' }}>{section.verse || '(Look up in your Bible app)'}</div>
                    </div>
                  )}

                  {/* Foundation & Declarations — ⬡B:SOUL:empty_state_onboarding:20260415⬡ */}
                  {sectionKey === 'foundationDeclarations' && (
                    <>
                      {section.empty ? (
                        <div style={{ padding: 24, background: 'rgba(245,217,154,0.08)', borderRadius: 12, borderLeft: '3px solid #c4a265' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#f5d99a', marginBottom: 8 }}>Make this your own</div>
                          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#c8c0d8' }}>{section.emptyMessage}</div>
                          <div style={{ fontSize: 12, color: '#a89cc8', marginTop: 12, fontStyle: 'italic' }}>
                            Try: "add declaration: I am covered by the blood", "my foundation scripture is Romans 8:28 for identity", "I'm praying about my marriage"
                          </div>
                        </div>
                      ) : (
                        <>
                          {section.foundationScriptures && section.foundationScriptures.length > 0 && (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#c4a265', marginBottom: 8 }}>Foundation Scriptures</div>
                              {section.foundationScriptures.map((s, i) => (
                                <div key={i} style={{ padding: '8px 0', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <span style={{ fontWeight: 600, color: '#f5d99a' }}>{s.ref}</span>
                                  {s.theme && <span style={{ color: '#a89cc8', fontSize: 13 }}> — {s.theme}</span>}
                                </div>
                              ))}
                            </>
                          )}
                          {section.declarations && section.declarations.length > 0 && (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#c4a265', marginTop: 16, marginBottom: 8 }}>Daily Declarations</div>
                              {section.declarations.map((d, i) => (
                                <div key={i} style={{ padding: '8px 0', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{i + 1}. {d}</div>
                              ))}
                            </>
                          )}
                          {section.prayerFocus && section.prayerFocus.length > 0 && (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#c4a265', marginTop: 16, marginBottom: 8 }}>Prayer Focus</div>
                              {section.prayerFocus.map((p, i) => (
                                <div key={i} style={{ padding: '8px 0', fontSize: 14 }}>
                                  <span style={{ fontWeight: 600 }}>{p.focus}</span> {p.scripture && <span style={{ color: '#a89cc8' }}>= {p.scripture}</span>}
                                  {p.text && <span style={{ color: '#f5d99a' }}> {p.text}</span>}
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Daily Prophecy — ⬡B:SOUL:empty_prophecy:20260415⬡ */}
                  {sectionKey === 'dailyProphecy' && !section.prophecy && (
                    <div style={{ padding: 24, background: 'rgba(245,217,154,0.08)', borderRadius: 12, borderLeft: '3px solid #c4a265' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#f5d99a', marginBottom: 8 }}>Add your prophecies</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: '#c8c0d8' }}>
                        Prophetic words spoken over you are meant to be remembered. Talk to ABA and share them.
                      </div>
                      <div style={{ fontSize: 12, color: '#a89cc8', marginTop: 12, fontStyle: 'italic' }}>
                        Try: "log a prophecy from Pastor Q on July 30 2025: you haven't scratched the surface"
                      </div>
                    </div>
                  )}
                  {sectionKey === 'dailyProphecy' && section.prophecy && (
                    <div style={{ padding: 16, background: 'rgba(196,162,101,0.08)', borderRadius: 12, borderLeft: '3px solid #c4a265' }}>
                      <div style={{ fontSize: 13, color: '#c4a265', marginBottom: 8 }}>{section.prophecy.speaker} — {section.prophecy.date} — to {section.prophecy.recipient}</div>
                      <div style={{ fontSize: 15, lineHeight: 1.6, fontStyle: 'italic' }}>"{section.prophecy.text}"</div>
                    </div>
                  )}

                  {/* Better Man Challenge */}
                  {sectionKey === 'betterManChallenge' && (
                    <>
                      {section.time && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, color: '#c4a265', marginBottom: 6 }}>{section.time.title}</div>
                          {section.time.items?.map((item, i) => <div key={i} style={{ fontSize: 14, padding: '4px 0', color: '#c8c0d8' }}>{item}</div>)}
                        </div>
                      )}
                      {section.motion && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, color: '#c4a265', marginBottom: 6 }}>{section.motion.title}</div>
                          {section.motion.items?.map((item, i) => <div key={i} style={{ fontSize: 14, padding: '4px 0', color: '#c8c0d8' }}>{item}</div>)}
                        </div>
                      )}
                      <div style={{ fontSize: 14, color: '#c8c0d8', padding: '8px 0' }}><strong style={{color:'#c4a265'}}>ATTITUDE:</strong> {section.attitude}</div>
                      <div style={{ fontSize: 14, color: '#c8c0d8', padding: '8px 0' }}><strong style={{color:'#c4a265'}}>REMINDER:</strong> {section.reminder}</div>
                    </>
                  )}

                  {/* Answer Key */}
                  {sectionKey === 'answerKey' && (
                    <>
                      <button onClick={() => setShowAnswerKey(!showAnswerKey)} style={{
                        width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'rgba(196,162,101,0.2)', color: '#f5d99a', fontSize: 14, fontWeight: 600
                      }}>{showAnswerKey ? 'Hide Answers' : 'Reveal Answer Key'}</button>
                      {showAnswerKey && section.answers?.map((a, i) => (
                        <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 15 }}>
                          <strong>{a.number}. {a.name}</strong> = {a.meaning}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Generic sections (breath, exercise, book time) */}
                  {['breathChallenge', 'exerciseTime', 'bookTime'].includes(sectionKey) && (
                    <div style={{ fontSize: 14, color: '#c8c0d8' }}>
                      {section.content && <div>{section.content}</div>}
                      {section.trackField && <div style={{ marginTop: 8, color: '#f5d99a' }}>{section.trackField}</div>}
                      {section.duration && <div style={{ fontWeight: 600, color: '#c4a265' }}>{section.duration}</div>}
                      {section.options?.map((o, i) => (
                        <div key={i} style={{ padding: '6px 0' }}>☐ {o}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nav Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={prevSection} disabled={currentSection === 0} style={{
                  flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.08)', color: '#e8e0f0', fontSize: 14, opacity: currentSection === 0 ? 0.3 : 1
                }}>← Previous</button>
                {currentSection < SECTION_NAMES.length - 1 ? (
                  <button onClick={() => { completeSection(sectionKey); nextSection(); }} style={{
                    flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #c4a265, #f5d99a)', color: '#1a1040', fontSize: 14, fontWeight: 600
                  }}>Complete & Next →</button>
                ) : (
                  <button onClick={() => completeSection(sectionKey)} style={{
                    flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #22c55e, #4ade80)', color: '#1a1040', fontSize: 14, fontWeight: 600
                  }}>Finish Routine ✓</button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* QUIZ TAB */}
      {tab === 'quiz' && (
        <div>
          {!questions.length && !results && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 16, marginBottom: 16 }}>Names of God Quiz</div>
              {[10, 20, 39].map(n => (
                <button key={n} onClick={() => startQuiz(n)} style={{
                  display: 'block', width: '100%', padding: 14, marginBottom: 8, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.08)', color: '#e8e0f0', fontSize: 15
                }}>{n} Questions</button>
              ))}
            </div>
          )}

          {questions.length > 0 && !results && (
            <div>
              {questions.map(q => (
                <div key={q.number} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f5d99a' }}>{q.number}. {q.name}</div>
                  <div style={{ fontSize: 12, color: '#a89cc8' }}>{q.scripture}</div>
                  <input type="text" placeholder="Your answer..." value={answers[q.number] || ''} onChange={e => setAnswer(q.number, e.target.value)} style={{
                    width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: '#e8e0f0', fontSize: 14, outline: 'none'
                  }} />
                </div>
              ))}
              <button onClick={submitQuiz} disabled={quizLoading} style={{
                width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #c4a265, #f5d99a)', color: '#1a1040', fontSize: 15, fontWeight: 600
              }}>{quizLoading ? 'Grading...' : 'Submit All Answers'}</button>
            </div>
          )}

          {results && (
            <div>
              <div style={{ textAlign: 'center', padding: 20, fontSize: 24, fontWeight: 700, color: results.percentage >= 80 ? '#22c55e' : results.percentage >= 60 ? '#f59e0b' : '#ef4444' }}>
                {results.score}/{results.total} ({results.percentage}%)
              </div>
              {results.results?.map(r => (
                <div key={r.number} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14 }}>
                  <span style={{ color: r.correct ? '#22c55e' : '#ef4444' }}>{r.correct ? '✓' : '✗'}</span>{' '}
                  <strong>{r.name}</strong>: {r.correct ? r.correctAnswer : <><s style={{color:'#ef4444'}}>{r.userAnswer || '(blank)'}</s> → {r.correctAnswer}</>}
                </div>
              ))}
              <button onClick={() => { startQuiz(0); }} style={{
                width: '100%', padding: 14, marginTop: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.08)', color: '#e8e0f0', fontSize: 14
              }}>Try Again</button>
            </div>
          )}
        </div>
      )}

      {/* SERMON TAB */}
      {tab === 'sermon' && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f5d99a', marginBottom: 12 }}>Sermon Notes</div>
          {['title', 'speaker', 'date', 'scripture'].map(field => (
            <input key={field} type={field === 'date' ? 'date' : 'text'} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={sermonData[field]} onChange={e => updateField(field, e.target.value)} style={{
              width: '100%', padding: 12, marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)', color: '#e8e0f0', fontSize: 14, outline: 'none'
            }} />
          ))}
          <textarea placeholder="Notes..." value={sermonData.notes} onChange={e => updateField('notes', e.target.value)} rows={6} style={{
            width: '100%', padding: 12, marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)', color: '#e8e0f0', fontSize: 14, outline: 'none', resize: 'vertical'
          }} />
          <input type="text" placeholder="Key phrases (comma separated)" value={sermonData.keyPhrases} onChange={e => updateField('keyPhrases', e.target.value)} style={{
            width: '100%', padding: 12, marginBottom: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)', color: '#e8e0f0', fontSize: 14, outline: 'none'
          }} />
          <button onClick={saveNotes} disabled={saving} style={{
            width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: saved ? '#22c55e' : 'linear-gradient(135deg, #c4a265, #f5d99a)', color: '#1a1040', fontSize: 15, fontWeight: 600
          }}>{saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Sermon Notes'}</button>
        </div>
      )}

      {/* NAMES TAB */}
      {tab === 'names' && (
        <NamesReference />
      )}
    </div>
  );
}

function NamesReference() {
  const [names, setNames] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_BASE || 'https://abacia-services.onrender.com'}/api/soul/names`)
      .then(r => r.json()).then(setNames).catch(() => {});
  }, []);

  if (!names) return <div style={{ textAlign: 'center', padding: 20, color: '#a89cc8' }}>Loading names...</div>;

  const list = filter === 'standard' ? names.standard : filter === 'lesser-known' ? names.lesserKnown : [...names.standard, ...names.lesserKnown];

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[['all', `All (${names.total})`], ['standard', `Standard (${names.standard.length})`], ['lesser-known', `Lesser-Known (${names.lesserKnown.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            flex: 1, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
            background: filter === key ? 'rgba(196,162,101,0.3)' : 'rgba(255,255,255,0.06)', color: filter === key ? '#f5d99a' : '#a89cc8'
          }}>{label}</button>
        ))}
      </div>
      {list.map((n, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f5d99a' }}>{n.name}</div>
          <div style={{ fontSize: 13, color: '#c4a265' }}>{n.meaning}</div>
          <div style={{ fontSize: 12, color: '#a89cc8' }}>{n.pronunciation} | {n.scripture}</div>
          <div style={{ fontSize: 13, color: '#c8c0d8', marginTop: 4 }}>{n.context}</div>
          {n.wordStudy && <div style={{ fontSize: 12, color: '#8b5cf6', marginTop: 4 }}>{n.wordStudy}</div>}
        </div>
      ))}
    </div>
  );
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://abacia-services.onrender.com';
