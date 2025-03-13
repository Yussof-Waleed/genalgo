    // ------------------------------
    // GLOBAL VARIABLES & SETTINGS
    // ------------------------------
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let citiesData = [];
    let simulationRunning = false;
    let selectedCity = null;
    let isDragging = false;
    let fitnessHistory = []; // each element: { generation, distance, route }
    let fitnessChart = null; // Chart.js instance
    let cityLabels = [];
    let startCityIndex = 0;
    let finalCityIndex = 1; 
    let globalBest = null; // Global best chromosome

    // High-DPI canvas fix
    function resizeCanvas() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    // ------------------------------
    // FRONT-END CITY GENERATION
    // ------------------------------
    function generateRandomCities(num) {
      const margin = 0.1;
      const minDist = 0.05;
      let cities = [];
      cityLabels = [];
      while (cities.length < num) {
        let x = margin + Math.random() * (1 - 2 * margin);
        let y = margin + Math.random() * (1 - 2 * margin);
        if (!cities.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < minDist)) {
          cities.push([x, y]);
          cityLabels.push("City " + (cities.length));
        }
      }
      updateStartCitySelect(cities.length);
      updateFinalCitySelect(cities.length);
      return cities;
    }

    function updateStartCitySelect(numberOfCities) {
      const select = document.getElementById('startCitySelect');
      select.innerHTML = "";
      cityLabels.forEach((label, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.innerText = label;
        select.appendChild(opt);
      });
      select.value = Math.floor(Math.random() * numberOfCities);
    }

    function updateFinalCitySelect(numberOfCities) {
      const select = document.getElementById('finalCitySelect');
      select.innerHTML = "";
      cityLabels.forEach((label, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.innerText = label;
        select.appendChild(opt);
      });
      select.value = Math.floor(Math.random() * numberOfCities);
    }

    function updateStartCity() {
      startCityIndex = parseInt(document.getElementById('startCitySelect').value);
      drawStaticElements();
    }

    function updateFinalCity() {
      finalCityIndex = parseInt(document.getElementById('finalCitySelect').value);
      drawStaticElements();
    }

    // ------------------------------
    // UPDATE MUTATION RATE RANGE BASED ON POP SIZE & NUM CITIES
    // ------------------------------
    function updateMutationRateRange() {
      const popSize = parseInt(document.getElementById('popSize').value);
      const numCities = parseInt(document.getElementById('numCities').value);
      const mutationSlider = document.getElementById('mutationRate');
      mutationSlider.min = (1 / popSize).toFixed(4);
      mutationSlider.max = 100;
      let current = parseFloat(mutationSlider.value);
      if (current < mutationSlider.min) current = mutationSlider.min;
      if (current > mutationSlider.max) current = mutationSlider.max;
      mutationSlider.value = current;
      document.getElementById('mutationRateValue').textContent = current;
    }

    // ------------------------------
    // INITIALIZATION
    // ------------------------------
    function initialize() {
      const num = parseInt(document.getElementById('numCities').value);
      citiesData = generateRandomCities(num);
      resizeCanvas();
      drawStaticElements();
      setupChart();
      updateMutationRateRange();
    }

    // ------------------------------
    // DRAWING FUNCTIONS
    // ------------------------------
    function drawStaticElements() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      citiesData.forEach((point, index) => {
        const [x, y] = point;
        const px = x * canvas.width / (window.devicePixelRatio || 1);
        const py = y * canvas.height / (window.devicePixelRatio || 1);
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, 2 * Math.PI);
        // Highlight start city in green; final destination in orange.
        if (index === startCityIndex) {
          ctx.fillStyle = '#27ae60';
        } else if (index === finalCityIndex && finalCityIndex !== startCityIndex) {
          ctx.fillStyle = '#e67e22';
        } else {
          ctx.fillStyle = '#666';
        }
        ctx.fill();
        ctx.font = "14px Arial";
        ctx.fillStyle = "#000";
        ctx.textBaseline = "bottom";
        ctx.fillText(cityLabels[index], px + 10, py - 10);
      });
    }

    // ------------------------------
    // CHART.JS: FITNESS EVOLUTION CHART SETUP & UPDATE
    // ------------------------------
    function setupChart() {
      const ctxChart = document.getElementById('chartCanvas').getContext('2d');
      fitnessChart = new Chart(ctxChart, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'Best Distance',
            data: [],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52,152,219,0.2)',
            fill: true,
            tension: 0.2
          }]
        },
        options: {
          scales: {
            x: { title: { display: true, text: 'Generation' } },
            y: { title: { display: true, text: 'Best Distance' } }
          },
          onClick: (evt) => {
            const points = fitnessChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
            if (points.length) {
              const index = points[0].index;
              const gen = fitnessChart.data.labels[index];
              const entry = fitnessHistory.find(item => item.generation == gen);
              if (entry) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawStaticElements();
                drawBestRouteWithLabeledArrows(entry.route);
              }
            }
          }
        }
      });
    }
    function updateChart() {
      if (!fitnessChart) return;
      fitnessChart.data.labels = fitnessHistory.map(d => d.generation);
      fitnessChart.data.datasets[0].data = fitnessHistory.map(d => d.distance);
      fitnessChart.update();
    }

    // ------------------------------
    // ARROW DRAWING WITH ORDER LABELS
    // ------------------------------
    function drawArrowWithLabel(start, end, order) {
      const [sx, sy] = [start[0] * canvas.width / (window.devicePixelRatio || 1), start[1] * canvas.height / (window.devicePixelRatio || 1)];
      const [ex, ey] = [end[0] * canvas.width / (window.devicePixelRatio || 1), end[1] * canvas.height / (window.devicePixelRatio || 1)];
      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2;
      const angle = Math.atan2(ey - sy, ex - sx);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = "#007bff";
      ctx.lineWidth = 2;
      ctx.stroke();
      const arrowLength = 10;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(
        mx - arrowLength * Math.cos(angle - Math.PI / 6),
        my - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        mx - arrowLength * Math.cos(angle + Math.PI / 6),
        my - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.lineTo(mx, my);
      ctx.fillStyle = "#007bff";
      ctx.fill();
      ctx.font = "12px Arial";
      ctx.fillStyle = "#000";
      ctx.textBaseline = "bottom";
      ctx.fillText(order.toString(), mx, my - 12);
    }
    // Draw the route using arrows and labels.
    // If startCityIndex !== finalCityIndex, do not draw a closing link.
    function drawBestRouteWithLabeledArrows(routeIndices) {
      for (let i = 0; i < routeIndices.length - 1; i++) {
        const start = citiesData[routeIndices[i]];
        const end = citiesData[routeIndices[i + 1]];
        drawArrowWithLabel(start, end, i + 1);
      }
      if (startCityIndex === finalCityIndex) {
        const last = citiesData[routeIndices[routeIndices.length - 1]];
        const first = citiesData[routeIndices[0]];
        drawArrowWithLabel(last, first, routeIndices.length);
      }
    }

    // ------------------------------
    // SIMULATION LOOP (WITH GLOBAL BEST TRACKING)
    // ------------------------------
    async function simulationLoop() {
      const maxGen = parseInt(document.getElementById('maxGenerations').value);
      const evolutionSpeed = parseInt(document.getElementById('evolutionSpeed').value);
      while (simulationRunning) {
        try {
          const response = await fetch('http://127.0.0.1:5000/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              running: simulationRunning,
              mutation_rate: parseFloat(document.getElementById('mutationRate').value),
              selection_method: document.getElementById('populationSelectionMethod').value
            })
          });
          const bestRoute = await response.json();
          console.log("Generation:", bestRoute.generation, "Distance:", bestRoute.distance);
          fitnessHistory.push({ generation: bestRoute.generation, distance: bestRoute.distance, route: bestRoute.route });
          updateChart();
          if (!globalBest || bestRoute.distance < globalBest.distance) {
            globalBest = { generation: bestRoute.generation, distance: bestRoute.distance, route: bestRoute.route };
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawStaticElements();
          ctx.beginPath();
          const route = bestRoute.route;
          for (let i = 0; i < route.length; i++) {
            const [x, y] = citiesData[route[i]];
            const px = x * canvas.width / (window.devicePixelRatio || 1);
            const py = y * canvas.height / (window.devicePixelRatio || 1);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          if (startCityIndex === finalCityIndex) {
            const [sx, sy] = citiesData[route[0]];
            ctx.lineTo(sx * canvas.width / (window.devicePixelRatio || 1), sy * canvas.height / (window.devicePixelRatio || 1));
          }
          ctx.strokeStyle = "#3498db";
          ctx.lineWidth = 2;
          ctx.stroke();
          document.getElementById('generationCount').textContent = bestRoute.generation;
          document.getElementById('bestDistance').textContent = bestRoute.distance.toFixed(2);
          if (bestRoute.generation >= maxGen) {
            simulationRunning = false;
            setConfigControlsDisabled(false);
            toggleButtonState(simulationRunning);
            displayFinalSolution(globalBest);
            break;
          }
        } catch (error) {
          console.error("Error in simulation loop:", error);
        }
        await new Promise(resolve => setTimeout(resolve, evolutionSpeed));
      }
    }

    // ------------------------------
    // SIMULATION CONTROL & CONFIG LOCKDOWN
    // ------------------------------

    function toggleButtonState(isActive) {
        const btn = document.getElementById('startBtn');
        if (isActive) {
            btn.textContent = 'Stop';
            btn.classList.remove('bg-indigo-600');
            btn.classList.add('bg-red-600');
        } else {
            btn.textContent = 'Start';
            btn.classList.remove('bg-red-600');
            btn.classList.add('bg-indigo-600');
        }
    }

    async function toggleSimulation() {

      // Basic sanity check
      if (!citiesData || citiesData.length < 2) {
        alert("Not enough city data to simulate.");
        return;
      }

      simulationRunning = !simulationRunning;
      setConfigControlsDisabled(simulationRunning);

      if (simulationRunning) {
        toggleButtonState(simulationRunning);
        fitnessHistory = [];
        globalBest = null;
        updateChart();
        updateMutationRateRange();

        try {
          await fetch('http://127.0.0.1:5000/api/set_cities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cities: citiesData, depot: startCityIndex, final: finalCityIndex })
          });
          simulationLoop();
        } catch (error) {
          console.error("Error setting cities:", error);
          alert("Failed to set cities on the server.");
          simulationRunning = false;
          setConfigControlsDisabled(false);
          toggleButtonState(simulationRunning);
        }

      } else {
        try {
          await fetch('http://127.0.0.1:5000/api/stop', { method: 'POST' });
        } catch (error) {
          console.error("Error stopping simulation:", error);
        }
        toggleButtonState(false);
        setConfigControlsDisabled(false);
      }
    }
    function setConfigControlsDisabled(disabled) {
      document.getElementById('numCities').disabled = disabled;
      document.getElementById('popSize').disabled = disabled;
      document.getElementById('mutationRate').disabled = disabled;
      document.getElementById('populationSelectionMethod').disabled = disabled;
      document.getElementById('crossoverMethod').disabled = disabled;
      document.getElementById('mutationMethod').disabled = disabled;
      document.getElementById('randomizeBtn').disabled = disabled;
      document.getElementById('maxGenerations').disabled = disabled;
      document.getElementById('evolutionSpeed').disabled = disabled;
      document.getElementById('startCitySelect').disabled = disabled;
      document.getElementById('finalCitySelect').disabled = disabled;
    }

    // ------------------------------
    // FINAL SOLUTION DISPLAY
    // ------------------------------
    function displayFinalSolution(finalData) {
      const last = finalData || (fitnessHistory.length > 0 ? fitnessHistory[fitnessHistory.length - 1] : null);
      if (!last) return;
      document.getElementById('finalGeneration').textContent = "Final Generation: " + last.generation;
      document.getElementById('finalDistance').textContent = "Best Distance: " + last.distance.toFixed(2);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawStaticElements();
      const route = last.route;
      drawBestRouteWithLabeledArrows(route);
      const finalRouteImage = document.getElementById('finalRouteImage');
      finalRouteImage.src = canvas.toDataURL("image/png");
      document.getElementById('finalSolutionOverlay').classList.remove('hidden');
    }
    function closeFinalSolution() {
      document.getElementById('finalSolutionOverlay').classList.add('hidden');
    }

    // ------------------------------
    // EVENT HANDLERS: DRAGGING & RENAMING
    // ------------------------------
    canvas.addEventListener('mousedown', (e) => {
      if (simulationRunning) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      selectedCity = citiesData.findIndex(([cx, cy]) => Math.hypot(cx - x, cy - y) < 0.03);
      if (selectedCity !== -1) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
      }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (simulationRunning) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (isDragging && selectedCity !== null) {
        citiesData[selectedCity] = [x, y];
        drawStaticElements();
      }
    });
    canvas.addEventListener('mouseup', () => {
      isDragging = false;
      selectedCity = null;
      canvas.style.cursor = 'default';
    });
    canvas.addEventListener('mouseleave', () => {
      isDragging = false;
      selectedCity = null;
    });
    canvas.addEventListener('dblclick', (e) => {
      if (simulationRunning) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const cityIndex = citiesData.findIndex(([cx, cy]) => Math.hypot(cx - x, cy - y) < 0.03);
      if (cityIndex !== -1) {
        const newName = prompt("Enter new name for this city:", cityLabels[cityIndex]);
        if (newName && newName.trim() !== "") {
          cityLabels[cityIndex] = newName;
          updateStartCitySelect();
          updateFinalCitySelect();
          drawStaticElements();
        }
      }
    });

    // ------------------------------
    // EVENT HANDLERS: CONFIG CHANGES
    // ------------------------------
    document.getElementById('numCities').addEventListener('change', () => {
      const newCount = parseInt(document.getElementById('numCities').value);
      const currentCount = citiesData.length;
      if (newCount > currentCount) {
        for (let i = currentCount; i < newCount; i++) {
          citiesData.push([Math.random(), Math.random()]);
          cityLabels.push("City " + (i + 1));
        }
      } else if (newCount < currentCount) {
        citiesData.splice(newCount, currentCount - newCount);
        cityLabels.splice(newCount, currentCount - newCount);
      }
      updateStartCitySelect();
      updateFinalCitySelect();
      updateMutationRateRange();
      drawStaticElements();
    });
    document.getElementById('popSize').addEventListener('change', updateMutationRateRange);
    function randomizeCities() {
      const num = parseInt(document.getElementById('numCities').value);
      citiesData = generateRandomCities(num);
      drawStaticElements();
    }
    document.getElementById('mutationRate').addEventListener('input', (e) => {
      document.getElementById('mutationRateValue').textContent = parseFloat(e.target.value).toFixed(4);
    });
    document.getElementById('evolutionSpeed').addEventListener('input', (e) => {
      document.getElementById('evolutionSpeedValue').textContent = e.target.value;
    });
    document.getElementById('startBtn').addEventListener('click', toggleSimulation);
    window.addEventListener('load', initialize);