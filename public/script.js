// Tab switching functionality
document.addEventListener("DOMContentLoaded", function () {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");

      // Remove active class from all buttons and contents
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Add active class to clicked button and corresponding content
      button.classList.add("active");
      document.getElementById(targetTab).classList.add("active");
    });
  });

  // Forecast functionality
  const forecastButton = document.getElementById("getForecast");
  const forecastResults = document.getElementById("forecastResults");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");

  forecastButton.addEventListener("click", async () => {
    const latitude = parseFloat(latitudeInput.value);
    const longitude = parseFloat(longitudeInput.value);

    if (isNaN(latitude) || isNaN(longitude)) {
      showError(
        forecastResults,
        "Please enter valid latitude and longitude values."
      );
      return;
    }

    if (latitude < -90 || latitude > 90) {
      showError(forecastResults, "Latitude must be between -90 and 90.");
      return;
    }

    if (longitude < -180 || longitude > 180) {
      showError(forecastResults, "Longitude must be between -180 and 180.");
      return;
    }

    await getForecast(latitude, longitude);
  });

  // Alerts functionality
  const alertsButton = document.getElementById("getAlerts");
  const alertsResults = document.getElementById("alertsResults");
  const stateInput = document.getElementById("state");

  alertsButton.addEventListener("click", async () => {
    const state = stateInput.value.trim().toUpperCase();

    if (!state || state.length !== 2) {
      showError(
        alertsResults,
        "Please enter a valid 2-letter state code (e.g., CA, NY, TX)."
      );
      return;
    }

    await getAlerts(state);
  });

  // Helper function to show loading state
  function showLoading(element) {
    element.textContent = "Loading...";
    element.className = "results loading";
  }

  // Helper function to show error
  function showError(element, message) {
    element.textContent = message;
    element.className = "results error";
  }

  // Helper function to show success
  function showSuccess(element, content) {
    element.textContent = content;
    element.className = "results success";
  }

  // Get forecast function
  async function getForecast(latitude, longitude) {
    showLoading(forecastResults);

    try {
      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch forecast");
      }

      showSuccess(forecastResults, data.forecast);
    } catch (error) {
      showError(forecastResults, `Error: ${error.message}`);
    }
  }

  // Get alerts function
  async function getAlerts(state) {
    showLoading(alertsResults);

    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch alerts");
      }

      showSuccess(alertsResults, data.alerts);
    } catch (error) {
      showError(alertsResults, `Error: ${error.message}`);
    }
  }

  // Add some example coordinates for quick testing
  latitudeInput.addEventListener("focus", function () {
    if (!this.value) {
      this.value = "40.7128"; // New York City
    }
  });

  longitudeInput.addEventListener("focus", function () {
    if (!this.value) {
      this.value = "-74.0060"; // New York City
    }
  });

  stateInput.addEventListener("focus", function () {
    if (!this.value) {
      this.value = "NY"; // New York
    }
  });
});
