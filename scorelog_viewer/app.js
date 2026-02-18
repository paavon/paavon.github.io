// Tags for which cumulative data IS available (add tag names here)
const CUMULATIVE_INCLUDED_TAGS = [
  "pollution", // example: cumulative pollution makes sense
  "production", // example: cumulative production
  "gold", // example: cumulative gold
  // Add more tag names as needed
  "mfg"
];
const DEFAULT_SCORELOG_FILES = [
  "json/Suomipeli2025_freeciv21-score.json",
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
      height: 620,
      toolbar: { show: true },
      zoom: { enabled: true },
      stacked: window.SCORELOG_STACKED === true
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
    tooltip: {
      shared: true,
      intersect: false
    },
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
    // Remove stats div if present
    const statsDivOld = document.getElementById("max-values");
    if (statsDivOld) statsDivOld.remove();
    return;
  }
  chart.updateOptions(buildOptions(tagBlock.tag), false, true);
  chart.updateOptions({ yaxis: { title: { text: tagBlock.tag } } }, false, true);
  chart.updateSeries(tagBlock.series);
  showGovLegend(tagBlock.tag === "gov");

  // Show maximum and cumulative values per player in a table, or message if not available
  let statsDiv = document.getElementById("max-values");
  if (!statsDiv) {
    statsDiv = document.createElement("div");
    statsDiv.id = "max-values";
    statsDiv.style.margin = "8px 0 0 0";
    statsDiv.style.fontSize = "0.95em";
    document.querySelector("#chart").parentNode.appendChild(statsDiv);
  }
  if (Array.isArray(tagBlock.series)) {
    const tagName = tagBlock.tag;
    const cumulativeAllowed = CUMULATIVE_INCLUDED_TAGS.includes(tagName);
    // Build stats: max value, turn, cumulative
    let statList = tagBlock.series
      .filter(s => s && Array.isArray(s.data) && s.data.length > 0)
      .map(s => {
        let max = -Infinity, maxTurn = null, total = 0;
        for (const d of s.data) {
          if (typeof d.y === 'number') {
            total += d.y;
            if (d.y > max) {
              max = d.y;
              maxTurn = d.x;
            }
          }
        }
        return { name: s.name, max, maxTurn, total };
      })
      .sort((a, b) => b.max - a.max);
    let html = '<b>Player stats:</b>';
    html += '<table style="margin:0.5em 0 0 0.5em;border-collapse:collapse"><thead><tr>' +
      '<th style="text-align:left;padding:2px 8px 2px 0">Player</th>' +
      '<th style="text-align:right;padding:2px 8px">Max value</th>' +
      '<th style="text-align:right;padding:2px 8px">at turn</th>';
    if (cumulativeAllowed) {
      html += '<th style="text-align:right;padding:2px 8px">Cumulative</th>';
    }
    html += '</tr></thead><tbody>';
    for (const entry of statList) {
      const cleanName = entry.name.replace(/^\d+\s+/, "");
      html += `<tr>` +
        `<td style="padding:2px 8px 2px 0"><b>${cleanName}</b></td>` +
        `<td style="text-align:right;padding:2px 8px">${entry.max}</td>` +
        `<td style="text-align:right;padding:2px 8px">${entry.maxTurn}</td>`;
      if (cumulativeAllowed) {
        html += `<td style="text-align:right;padding:2px 8px">${entry.total}</td>`;
      }
      html += `</tr>`;
    }
    html += '</tbody></table>';
    if (!cumulativeAllowed) {
      html += '<div style="color:#ff8080;margin-top:0.5em">Cumulative data not available for this tag type.</div>';
    }
    statsDiv.innerHTML = html;
    statsDiv.style.display = "block";
  } else {
    statsDiv.style.display = "none";
  }
}

(async () => {
  const fileSelect = document.getElementById("fileSelect");
  const tagSelect = document.getElementById("tagSelect");
  const status = document.getElementById("status");
  // Add stacked checkbox
  let stackedBox = document.getElementById("stackedBox");
  if (!stackedBox) {
    stackedBox = document.createElement("label");
    stackedBox.style.margin = "0 0 0 12px";
    stackedBox.innerHTML = '<input type="checkbox" id="stackedInput"> Stacked';
    fileSelect.parentNode.appendChild(stackedBox);
  }
  const stackedInput = document.getElementById("stackedInput");
  window.SCORELOG_STACKED = stackedInput && stackedInput.checked;

  // Determine initial tag for tooltip customization
  let initialTag = null;
  try {
    const payload = await loadScorelog(fileSelect.value);
    initialTag = Object.values(payload.seriesByTag || {})[0]?.tag || null;
  } catch (e) {}
  const chart = new ApexCharts(document.querySelector("#chart"), buildOptions(initialTag));
  chart.render();
  if (stackedInput) {
    stackedInput.addEventListener("change", () => {
      window.SCORELOG_STACKED = stackedInput.checked;
      // Rebuild chart options with new stacked value
      const currentTag = tagSelect.value;
      chart.updateOptions(buildOptions(currentTag), false, true);
      chart.updateOptions({ yaxis: { title: { text: currentTag } } }, false, true);
    });
  }

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
