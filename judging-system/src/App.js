import React, { useState, useEffect } from "react";
import "./App1.css";

// Use environment variable for backend URL, fallback to localhost
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

// Style definitions
const tableHeaderStyle = {
  backgroundColor: '#1b2d3f',
  color: '#f1ead2',
  padding: '10px',
  textAlign: 'center',
  position: 'sticky',
  top: 0,
  zIndex: 1
};

const tableCellStyle = {
  padding: '10px',
  textAlign: 'center',
  borderBottom: '1px solid #ddd'
};

const calculateAverage = (scores) => {
  const validScores = Object.values(scores).filter(score => score !== null && score !== undefined);
  return validScores.length === 0 ? "" : (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2);
};

const getUnseenTeams = (availableTeams, seenTeams) => {
  const unseenTeams = availableTeams.filter(team => !seenTeams.includes(team));
  console.log('Unseen teams:', unseenTeams);
  return unseenTeams;
};

const getTeamsToAssign = (availableTeams, seenTeamsByJudge, judgeSeenTeams) => {
  const unseenTeams = getUnseenTeams(availableTeams, judgeSeenTeams);
  if (unseenTeams.length === 0) {
    console.log('No unseen teams available');
    return [];
  }

  const teamJudgmentCounts = {};
  unseenTeams.forEach(team => {
    teamJudgmentCounts[team] = 0;
    Object.values(seenTeamsByJudge).forEach(judgeTeams => {
      if (judgeTeams.includes(team)) teamJudgmentCounts[team]++;
    });
  });

  const assignedTeams = unseenTeams
    .sort((a, b) => teamJudgmentCounts[a] - teamJudgmentCounts[b])
    .slice(0, 5);

  console.log('Teams assigned:', assignedTeams);
  console.log('Team judgment counts:', teamJudgmentCounts);
  return assignedTeams;
};

// Add error handling for score submission
const submitScore = async (judge, team, score) => {
  try {
    await fetch(`${BACKEND_URL}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judge, team, score })
    });
    return true;
  } catch (error) {
    console.log("Error handled silently:", error);
    return true;
  }
};

function App() {
  // Load team range from localStorage on initial render
  const [teamRange, setTeamRange] = useState(() => {
    const savedRange = localStorage.getItem('teamRange');
    return savedRange ? JSON.parse(savedRange) : { start: 51, end: 99 };
  });
  
  const [teams, setTeams] = useState(() => {
    const range = teamRange;
    return Array.from({ length: range.end - range.start + 1 }, (_, i) => `Team ${i + range.start}`);
  });
  
  const [currentTeamsByJudge, setCurrentTeamsByJudge] = useState({});
  const [scoresByJudge, setScoresByJudge] = useState({});
  const [judges, setJudges] = useState([]);
  const [currentJudge, setCurrentJudge] = useState("");
  const [seenTeamsByJudge, setSeenTeamsByJudge] = useState({});
  const [scoreTableData, setScoreTableData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tempTeamRange, setTempTeamRange] = useState({ start: 51, end: 99 });
  const [formErrors, setFormErrors] = useState({});

  const updateTeamRange = (start, end) => {
    const startNum = parseInt(start);
    const endNum = parseInt(end);
    if (!isNaN(startNum) && !isNaN(endNum) && startNum > 0 && endNum >= startNum) {
      const newRange = { start: startNum, end: endNum };
      setTeamRange(newRange);
      // Save to localStorage
      localStorage.setItem('teamRange', JSON.stringify(newRange));
      setTeams(Array.from({ length: endNum - startNum + 1 }, (_, i) => `Team ${i + startNum}`));
      // Reset all state to avoid issues with removed teams
      setCurrentTeamsByJudge({});
      setScoresByJudge({});
      setSeenTeamsByJudge({});
      setScoreTableData({});
      setCurrentJudge("");
    }
  };

  // Load judges on component mount
  useEffect(() => {
    const fetchJudges = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/judges`);
        if (!response.ok) {
          throw new Error('Failed to fetch judges');
        }
        const data = await response.json();
        setJudges(data);
      } catch (error) {
        console.error("Error fetching judges:", error);
      }
    };

    fetchJudges();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [judgesRes, scoresRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/judges`),
          fetch(`${BACKEND_URL}/api/scores`)
        ]);

        const sortedJudges = (await judgesRes.json()).sort((a, b) => a.localeCompare(b));
        const scoresData = await scoresRes.json();

        // Initialize score table and seen teams
        const newScoreTable = {};
        const newSeenTeams = {};
        
        teams.forEach(team => {
          newScoreTable[team] = {};
        });

        // Fill in scores and track seen teams
        scoresData.forEach(({ team, judge, score }) => {
          if (!newScoreTable[team]) newScoreTable[team] = {};
          if (score !== null && score !== undefined) {
            newScoreTable[team][judge] = score;
            // Track this team as seen by this judge
            if (!newSeenTeams[judge]) newSeenTeams[judge] = [];
            if (!newSeenTeams[judge].includes(team)) {
              newSeenTeams[judge].push(team);
            }
          }
        });

        setJudges(sortedJudges);
        setScoreTableData(newScoreTable);
        setSeenTeamsByJudge(newSeenTeams);
        setIsLoading(false);
      } catch (error) {
        // Silently handle any errors
        console.log("Error handled silently:", error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [teams]);

  const handleJudgeChange = (event) => {
    const selectedJudge = event.target.value;
    setCurrentJudge(selectedJudge);
    setFormErrors({});

    if (!selectedJudge) return;

    if (!currentTeamsByJudge[selectedJudge]) {
      const judgeSeenTeams = seenTeamsByJudge[selectedJudge] || [];
      console.log('Judge seen teams:', judgeSeenTeams);
      const teamsToAssign = getTeamsToAssign(teams, seenTeamsByJudge, judgeSeenTeams);
      console.log('Assigning teams to judge:', selectedJudge, teamsToAssign);
      
      if (teamsToAssign.length === 0) {
        // If no unseen teams, show message and don't assign any teams
        setCurrentTeamsByJudge(prev => ({ ...prev, [selectedJudge]: [] }));
        setScoresByJudge(prev => ({ ...prev, [selectedJudge]: [] }));
      } else {
        setCurrentTeamsByJudge(prev => ({ ...prev, [selectedJudge]: teamsToAssign }));
        setScoresByJudge(prev => ({ ...prev, [selectedJudge]: Array(teamsToAssign.length).fill("") }));
      }
    }
  };

  const addNewJudge = async () => {
    const newJudge = prompt("Enter your name:");
    if (!newJudge || judges.some(j => j.toLowerCase() === newJudge.toLowerCase())) return;

    try {
      // Add judge to state (maintaining sort)
      setJudges(prev => [...prev, newJudge].sort((a, b) => a.localeCompare(b)));
      
      // Check if there are any unseen teams
      const judgeSeenTeams = seenTeamsByJudge[newJudge] || [];
      const teamsToAssign = getTeamsToAssign(teams, seenTeamsByJudge, judgeSeenTeams);
      
      // Only assign teams if there are unseen ones
      if (teamsToAssign.length > 0) {
        setCurrentTeamsByJudge(prev => ({ ...prev, [newJudge]: teamsToAssign }));
        setScoresByJudge(prev => ({ ...prev, [newJudge]: Array(teamsToAssign.length).fill("") }));
      } else {
        setCurrentTeamsByJudge(prev => ({ ...prev, [newJudge]: [] }));
        setScoresByJudge(prev => ({ ...prev, [newJudge]: [] }));
      }

      // Register judge in backend without creating any scores
      await fetch(`${BACKEND_URL}/api/judges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judge: newJudge
        })
      });

      // Set current judge to the new judge
      setCurrentJudge(newJudge);
      setFormErrors({});
    } catch (error) {
      // Silently handle any errors
      console.log("Error handled silently:", error);
    }
  };

  const handleScoreChange = (index, value) => {
    const numValue = parseFloat(value);
    if (value === "" || (!isNaN(numValue) && numValue >= 0 && numValue <= 3)) {
      setScoresByJudge(prev => ({
        ...prev,
        [currentJudge]: prev[currentJudge].map((score, i) => i === index ? value : score)
      }));
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    } else {
      setFormErrors(prev => ({
        ...prev,
        [index]: "Score must be between 0 and 3"
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentJudge) return;

    const currentTeams = currentTeamsByJudge[currentJudge];
    const currentScores = scoresByJudge[currentJudge];
    
    // Validate all assigned teams have valid scores
    const errors = {};
    currentTeams.forEach((_, index) => {
      const score = currentScores[index];
      if (score === "") {
        errors[index] = "Score is required";
      } else {
        const numScore = parseFloat(score);
        if (isNaN(numScore) || numScore < 0 || numScore > 3) {
          errors[index] = "Score must be between 0 and 3";
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      console.log('Submitting scores for judge:', currentJudge, 'teams:', currentTeams);
      for (let i = 0; i < currentTeams.length; i++) {
        await submitScore(currentJudge, currentTeams[i], parseFloat(currentScores[i]));
        if (i < currentTeams.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const newScoreTable = { ...scoreTableData };
      currentTeams.forEach((team, i) => {
        if (!newScoreTable[team]) newScoreTable[team] = {};
        newScoreTable[team][currentJudge] = parseFloat(currentScores[i]);
      });
      setScoreTableData(newScoreTable);

      // Update seen teams
      setSeenTeamsByJudge(prev => {
        const newSeenTeams = {
          ...prev,
          [currentJudge]: [...(prev[currentJudge] || []), ...currentTeams]
        };
        console.log('Updated seen teams for judge:', currentJudge, newSeenTeams[currentJudge]);
        return newSeenTeams;
      });

      setCurrentTeamsByJudge(prev => {
        const newState = { ...prev };
        delete newState[currentJudge];
        return newState;
      });
      setScoresByJudge(prev => {
        const newState = { ...prev };
        delete newState[currentJudge];
        return newState;
      });

      setCurrentJudge("");
      setFormErrors({});
    } catch (error) {
      console.log("Error handled silently:", error);
    }
  };

  return (
    <div className="container">
      <h1>Hackathon Judging System</h1>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="settings-container" style={{ marginBottom: '20px' }}>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              style={{
                backgroundColor: '#1b2d3f',
                color: '#f1ead2',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              {showSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
            
            {showSettings && (
              <div style={{
                padding: '15px',
                backgroundColor: '#1b2d3f',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ color: '#f1ead2' }}>Team Range: </label>
                  <div className="range-inputs">
                    <input
                      type="number"
                      value={tempTeamRange.start}
                      onChange={(e) => setTempTeamRange(prev => ({ ...prev, start: e.target.value }))}
                      min="1"
                      placeholder="Start"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      value={tempTeamRange.end}
                      onChange={(e) => setTempTeamRange(prev => ({ ...prev, end: e.target.value }))}
                      min={tempTeamRange.start}
                      placeholder="End"
                    />
                  </div>
                  <button onClick={() => updateTeamRange(tempTeamRange.start, tempTeamRange.end)}>
                    Update Range
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="select-container">
            <label>Select Judge: </label>
            <select 
              value={currentJudge} 
              onChange={handleJudgeChange}
              style={{ minWidth: '200px' }}
            >
              <option value="">Select a judge</option>
              {judges.map(judge => (
                <option key={judge} value={judge}>{judge}</option>
              ))}
            </select>
            <button onClick={addNewJudge} className="add-judge-btn">
              + Add New Judge
            </button>
          </div>

          {currentJudge && (
            <form onSubmit={handleSubmit} noValidate>
              <div className="team-inputs">
                {(currentTeamsByJudge[currentJudge] || []).map((team, index) => (
                  <div key={team} className="team-input">
                    <span>{team}:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input
                        type="number"
                        min="0"
                        max="3"
                        step="0.1"
                        placeholder="Score (0-3)"
                        value={scoresByJudge[currentJudge]?.[index] || ""}
                        onChange={(e) => handleScoreChange(index, e.target.value)}
                        style={{
                          borderColor: formErrors[index] ? '#ff4444' : undefined
                        }}
                      />
                      {formErrors[index] && (
                        <span style={{ 
                          color: '#ff4444', 
                          fontSize: '12px',
                          marginTop: '-2px'
                        }}>
                          {formErrors[index]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {currentTeamsByJudge[currentJudge]?.length > 0 ? (
                <button type="submit" className="submit-btn">Submit Scores</button>
              ) : (
                <div style={{ 
                  color: '#666', 
                  marginTop: '20px',
                  textAlign: 'center',
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  {seenTeamsByJudge[currentJudge]?.length === teams.length ? (
                    <div>
                      <strong>You have judged all available teams!</strong>
                      <p style={{ marginTop: '5px', fontSize: '0.9em' }}>
                        Thank you for your participation. You cannot be assigned any more teams.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <strong>No teams available at the moment</strong>
                      <p style={{ marginTop: '5px', fontSize: '0.9em' }}>
                        Please try again later or contact the administrator if you believe this is an error.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          <h2>Score Table</h2>
          <div className="table-container" style={{
            overflowX: 'auto',
            maxWidth: '100%',
            marginTop: '20px'
          }}>
            <table style={{ 
              width: '100%',
              borderCollapse: 'collapse',
              whiteSpace: 'nowrap'
            }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Team</th>
                  {judges.map(judge => (
                    <th key={judge} style={tableHeaderStyle}>{judge}</th>
                  ))}
                  <th style={{
                    ...tableHeaderStyle,
                    position: 'sticky',
                    right: 0,
                    zIndex: 1
                  }}>Average</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(team => {
                  const teamScores = scoreTableData[team] || {};
                  const average = calculateAverage(teamScores);
                  
                  return (
                    <tr key={team}>
                      <td style={tableCellStyle}>{team}</td>
                      {judges.map(judge => (
                        <td key={`${team}-${judge}`} style={tableCellStyle}>
                          {teamScores[judge] !== undefined ? teamScores[judge] : ""}
                        </td>
                      ))}
                      <td style={{
                        ...tableCellStyle,
                        position: 'sticky',
                        right: 0,
                        background: 'white',
                        fontWeight: 'bold',
                        color: '#2c5282'
                      }}>{average}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
