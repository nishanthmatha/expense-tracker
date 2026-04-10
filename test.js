const API_KEY = "M2EyNWM4MzQtOTNhMC00YTk1LWFjM2MtODM1NjdmY2RlYWYyOjkxNmRjMDQ5LWZkY2MtNDMzMC05MmU3LWM5NGZlN2YzOWNiNQ==";

async function getToken() {
  const encoded = Buffer.from(`${API_KEY}`).toString("base64");

  const res = await fetch("https://au-api.basiq.io/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${API_KEY}`,
      "Accept": "application/json",
      "basiq-version": "3.0",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=SERVER_ACCESS"
  });

  const data = await res.json();
  console.log(data);
}

getToken();