package com.openframe.sdk.fleetmdm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.HostSearchResponse;
import com.openframe.sdk.fleetmdm.model.QueryResult;
import com.openframe.sdk.fleetmdm.model.Query;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Main client for working with Fleet MDM REST API
 */
public class FleetMdmClient {

    private static final String HOSTS_URL = "/api/v1/fleet/hosts";
    private static final String QUERIES_URL = "/api/v1/fleet/queries";
    private static final String GET_ENROLL_SECRET_URL = "/api/latest/fleet/spec/enroll_secret";

    private final String baseUrl;
    private final String apiToken;
    private final HttpClient httpClient;

    /**
     * Thread-safe reusable {@link ObjectMapper}. Creating it once is cheaper than instantiating a new one
     * every request.
     */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Constructor intended for unit-tests – allows passing a pre-configured or mocked {@link HttpClient}.
     */
    FleetMdmClient(String baseUrl, String apiToken, HttpClient httpClient) {
        this.baseUrl  = baseUrl;
        this.apiToken = apiToken;
        this.httpClient = httpClient;
    }

    /**
     * @param baseUrl  Base URL of Fleet MDM (e.g., https://fleet.example.com)
     * @param apiToken API token for authorization
     */
    public FleetMdmClient(String baseUrl, String apiToken) {
        this.baseUrl = baseUrl;
        this.apiToken = apiToken;
        this.httpClient = HttpClient.newHttpClient();
    }

    /**
     * Get a single host by ID from Fleet MDM
     * @param id Host ID
     * @return Host object or null if not found
     */
    public Host getHostById(long id) throws IOException, InterruptedException {
        HttpRequest request = addHeaders(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + HOSTS_URL + "/" + id)))
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() == 401) {
            throw new RuntimeException("Authentication failed. Please check your API token. Response: " + response.body());
        } else if (response.statusCode() == 404) {
            return null; // Host not found
        } else if (response.statusCode() != 200) {
            throw new RuntimeException("Failed to fetch host. Status: " + response.statusCode() + ", Response: " + response.body());
        }

        return MAPPER.treeToValue(MAPPER.readTree(response.body()).path("host"), Host.class);
    }

    /**
     * Search for hosts using the provided query parameters
     * @param searchRequest Search parameters including query string, page, and per_page
     * @return List of matching Host objects
     * @throws IOException if an I/O exception occurs
     * @throws InterruptedException if the request is interrupted
     * @throws FleetMdmApiException if the API returns an error
     */
    public List<Host> searchHosts(HostSearchRequest searchRequest) throws IOException, InterruptedException {
        if (searchRequest == null) {
            throw new IllegalArgumentException("Search request cannot be null");
        }

        try {
            String url = buildSearchUrl(searchRequest);
            HttpRequest request = addHeaders(HttpRequest.newBuilder()
                    .uri(URI.create(url)))
                    .GET()
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new FleetMdmApiException("Authentication failed. Please check your API token.", response.statusCode(), response.body());
            } else if (response.statusCode() != 200) {
                throw new FleetMdmApiException("Failed to search hosts", response.statusCode(), response.body());
            }

            HostSearchResponse searchResponse = MAPPER.readValue(response.body(), HostSearchResponse.class);
            return searchResponse.getHosts() != null ? searchResponse.getHosts() : new ArrayList<>();
        } catch (Exception e) {
            if (e instanceof FleetMdmApiException) {
                throw e;
            }
            throw new FleetMdmException("Failed to process host search request", e);
        }
    }

    /**
     * Search for hosts by query string with default pagination
     * @param query Search query (e.g., hostname, UUID, IP address)
     * @return List of matching Host objects
     * @throws IOException if an I/O exception occurs
     * @throws InterruptedException if the request is interrupted
     * @throws FleetMdmApiException if the API returns an error
     */
    public List<Host> searchHosts(String query) throws IOException, InterruptedException {
        return searchHosts(new HostSearchRequest(query));
    }

    /**
     * Search for hosts by query string with custom pagination
     * @param query Search query (e.g., hostname, UUID, IP address)
     * @param page Page number (0-based)
     * @param perPage Number of results per page
     * @return List of matching Host objects
     * @throws IOException if an I/O exception occurs
     * @throws InterruptedException if the request is interrupted
     * @throws FleetMdmApiException if the API returns an error
     */
    public List<Host> searchHosts(String query, Integer page, Integer perPage) throws IOException, InterruptedException {
        return searchHosts(new HostSearchRequest(query, page, perPage));
    }

    /**
     * Build the search URL with query parameters
     */
    private String buildSearchUrl(HostSearchRequest searchRequest) {
        StringBuilder urlBuilder = new StringBuilder(baseUrl + HOSTS_URL);
        List<String> params = new ArrayList<>();

        if (searchRequest.getQuery() != null && !searchRequest.getQuery().trim().isEmpty()) {
            params.add("query=" + URLEncoder.encode(searchRequest.getQuery(), StandardCharsets.UTF_8));
        }

        if (searchRequest.getPage() != null) {
            params.add("page=" + searchRequest.getPage());
        }

        if (searchRequest.getPerPage() != null) {
            params.add("per_page=" + searchRequest.getPerPage());
        }

        if (searchRequest.getOrderKey() != null && !searchRequest.getOrderKey().trim().isEmpty()) {
            params.add("order_key=" + URLEncoder.encode(searchRequest.getOrderKey(), StandardCharsets.UTF_8));
        }

        if (searchRequest.getOrderDirection() != null && !searchRequest.getOrderDirection().trim().isEmpty()) {
            params.add("order_direction=" + URLEncoder.encode(searchRequest.getOrderDirection(), StandardCharsets.UTF_8));
        }

        if (!params.isEmpty()) {
            urlBuilder.append("?").append(String.join("&", params));
        }

        return urlBuilder.toString();
    }

    /**
     * Run an osquery SQL-like query on a specific host using its numeric ID
     * @param hostId The numeric ID of the host to query
     * @param query The osquery SQL statement to execute
     * @return QueryResult containing the query results or error information
     * @throws IOException if an I/O exception occurs
     * @throws InterruptedException if the request is interrupted
     * @throws FleetMdmApiException if the API returns an error
     */
    public QueryResult runQuery(long hostId, String query) throws IOException, InterruptedException {
        if (query == null || query.trim().isEmpty()) {
            throw new IllegalArgumentException("Query cannot be null or empty");
        }

        try {
            // Create request body
            String requestBody = MAPPER.writeValueAsString(
                    MAPPER.createObjectNode().put("query", query)
            );

            HttpRequest request = addHeaders(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + HOSTS_URL + "/" + hostId + "/query"))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .header("Content-Type", "application/json"))
                    .timeout(Duration.ofSeconds(90)) // Increased timeout for legitimate multi-query cases
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new FleetMdmApiException("Authentication failed. Please check your API token.", response.statusCode(), response.body());
            } else if (response.statusCode() == 404) {
                throw new FleetMdmApiException("Host not found with ID: " + hostId, response.statusCode(), response.body());
            } else if (response.statusCode() != 200) {
                throw new FleetMdmApiException("Failed to execute query", response.statusCode(), response.body());
            }

            QueryResult result = MAPPER.readValue(response.body(), QueryResult.class);
            if (result.getQuery() == null) {
                result.setQuery(query);
            }
            return result;
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to execute query on host: " + hostId, e);
        }
    }

    /**
     * Get the enroll secret from Fleet MDM
     * @return The enroll secret string or null if not found
     */
    public String getEnrollSecret() {
        try {
            HttpRequest request = addHeaders(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + GET_ENROLL_SECRET_URL)))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new FleetMdmApiException("Failed to fetch enroll secret", response.statusCode(), response.body());
            }

            JsonNode responseNode = MAPPER.readTree(response.body());
            JsonNode secretsArray = responseNode
                    .path("spec")
                    .path("secrets");

            if (secretsArray.isArray() && !secretsArray.isEmpty()) {
                return secretsArray.get(0).path("secret").asText();
            }

            throw new FleetMdmException("Failed to parse enroll secret: " + response.body());
        } catch (Exception e) {
            throw new FleetMdmException("Failed to process get enroll secret request", e);
        }
    }

    /**
     * Get a single query by ID from Fleet MDM
     * 
     * @param id Query ID
     * @return Query object or null if not found
     * @throws IOException if an I/O exception occurs
     * @throws InterruptedException if the request is interrupted
     * @throws FleetMdmApiException if the API returns an error
     */
    public Query getQueryById(long id) throws IOException, InterruptedException {
        HttpRequest request = addHeaders(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + QUERIES_URL + "/" + id)))
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() == 401) {
            throw new FleetMdmApiException("Authentication failed. Please check your API token.", response.statusCode(), response.body());
        } else if (response.statusCode() == 404) {
            return null; // Query not found
        } else if (response.statusCode() != 200) {
            throw new FleetMdmApiException("Failed to fetch query", response.statusCode(), response.body());
        }

        return MAPPER.treeToValue(MAPPER.readTree(response.body()).path("query"), Query.class);
    }

    private HttpRequest.Builder addHeaders(HttpRequest.Builder builder) {
        return builder
                .header("Authorization", "Bearer " + apiToken)
                .header("Accept", "application/json");
    }
}
