const DEFAULT_SCORELOG_FILES = [
  "json/demo1.json",
  "json/demo2.json"
];

async function loadScorelog(fileName) {
  const response = await fetch(fileName);
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName}: ${response.status}`);
  }
  return response.json();
}

function buildOptions(tag) {
  return {
    chart: {
      type: "line",
      height: 420,
      toolbar: { show: true },
      zoom: { enabled: true }
    },
    stroke: { width: 2 },
    markers: { size: 0 },
    xaxis: {
      type: "numeric",
      title: { text: "Turn" }
    },
    yaxis: {
      title: { text: "Value" }
    },
    legend: { position: "bottom" },
    noData: { text: "Select a tag to view data" }
  };
}

function populateTags(tagSelect, seriesByTag) {
  tagSelect.innerHTML = "";
  const entries = Object.entries(seriesByTag);
  entries.sort((a, b) => a[1].tag.localeCompare(b[1].tag));

  for (const [tagId, item] of entries) {
    const option = document.createElement("option");
    option.value = tagId;
    option.textContent = `${item.tag} (tag ${tagId})`;
    tagSelect.appendChild(option);
  }
}

function populateFileSelect(fileSelect, files) {
  fileSelect.innerHTML = "";
  for (const file of files) {
    const option = document.createElement("option");
    option.value = file;
    // Show only the filename, not the path
    option.textContent = file.split("/").pop();
    fileSelect.appendChild(option);
  }
}

function getRequestedFile(files) {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("file");
  if (requested && files.includes(requested)) {
    return requested;
  }
  return files[0];
}

function showGovLegend(show) {
  let govLegend = document.getElementById("gov-legend");
  if (!govLegend) {
    govLegend = document.createElement("div");
    govLegend.id = "gov-legend";
    govLegend.style.margin = "12px 0";
    govLegend.style.fontSize = "0.95em";
    govLegend.style.display = "none";
    document.querySelector("#chart").parentNode.appendChild(govLegend);
  }
  if (!show) {
    govLegend.style.display = "none";
    return;
  }
  const GOVERNMENT_NAMES = {
    "default": "Tribal (default)",
    0: "Anarchy",
    1: "Despotism",
    2: "Republic",
    3: "Democracy",
    4: "Monarchy",
    5: "Communism",
    6: "Fundamentalism",
    7: "Fascism",
    8: "Federation",
    9: "Corporate",
    10: "Cybernetic",
    11: "Ecotopia",
    12: "Theocracy",
    13: "Oligarchy",
    14: "Plutocracy",
    15: "Technocracy",
    16: "Matriarchy",
    17: "Patriarchy",
    18: "Utopia",
    19: "Tribal"
  };
  let html = '<b>Government Codes:</b><br><ul style="margin:0 0 0 1.2em;padding:0">';
  for (const [code, name] of Object.entries(GOVERNMENT_NAMES)) {
    html += `<li><b>${code}</b>: ${name}</li>`;
  }
  html += '</ul><br>According AI, taken from Freeciv government codes (common for classic rulesets). ';
  html += 'See: <a href="https://github.com/freeciv/freeciv/blob/master/common/government.h" target="_blank">https://github.com/freeciv/freeciv/blob/master/common/government.h</a>';
  govLegend.innerHTML = html;
  govLegend.style.display = "block";
}

function updateChart(chart, seriesByTag, tagId) {
  const tagBlock = seriesByTag[tagId];
  if (!tagBlock) {
    chart.updateSeries([]);
    showGovLegend(false);
    return;
  }
  chart.updateOptions(buildOptions(tagBlock.tag), false, true);
  chart.updateOptions({ yaxis: { title: { text: tagBlock.tag } } }, false, true);
  chart.updateSeries(tagBlock.series);
  showGovLegend(tagBlock.tag === "gov");
}

(async () => {
  const fileSelect = document.getElementById("fileSelect");
  const tagSelect = document.getElementById("tagSelect");
  const status = document.getElementById("status");
  // Determine initial tag for tooltip customization
  let initialTag = null;
  try {
    const payload = await loadScorelog(fileSelect.value);
    initialTag = Object.values(payload.seriesByTag || {})[0]?.tag || null;
  } catch (e) {}
  const chart = new ApexCharts(document.querySelector("#chart"), buildOptions(initialTag));
  chart.render();

  const files = Array.isArray(window.SCORELOG_FILES)
    ? window.SCORELOG_FILES
    : DEFAULT_SCORELOG_FILES;

  let seriesByTag = {};

  populateFileSelect(fileSelect, files);
  fileSelect.value = getRequestedFile(files);

  async function loadAndRender(fileName) {
    status.textContent = `Loading ${fileName}...`;
    try {
      const payload = await loadScorelog(fileName);
      seriesByTag = payload.seriesByTag || {};

      populateTags(tagSelect, seriesByTag);
      const firstTag = tagSelect.value;
      if (firstTag) {
        updateChart(chart, seriesByTag, firstTag);
      } else {
        updateChart(chart, {}, "");
      }

      status.textContent = `Loaded ${fileName}.`;
    } catch (error) {
      status.textContent = error.message;
      updateChart(chart, {}, "");
    }
  }

  try {
    await loadAndRender(fileSelect.value);

    fileSelect.addEventListener("change", (event) => {
      loadAndRender(event.target.value);
    });

    tagSelect.addEventListener("change", (event) => {
      updateChart(chart, seriesByTag, event.target.value);
    });
  } catch (error) {
    status.textContent = error.message;
  }
})();
