package com.openframe.sdk.fleetmdm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.HostSearchResponse;
import com.openframe.sdk.fleetmdm.model.QueryResult;
import com.openframe.sdk.fleetmdm.model.LiveQueryCampaign;
import com.openframe.sdk.fleetmdm.model.RunLiveQueryRequest;
import com.openframe.sdk.fleetmdm.model.Policy;
import com.openframe.sdk.fleetmdm.model.Query;
import com.openframe.sdk.fleetmdm.model.CreatePolicyRequest;
import com.openframe.sdk.fleetmdm.model.UpdatePolicyRequest;
import com.openframe.sdk.fleetmdm.model.CreateScheduledQueryRequest;
import com.openframe.sdk.fleetmdm.model.UpdateScheduledQueryRequest;

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
import java.util.concurrent.CompletableFuture;

/**
 * Main client for working with Fleet MDM REST API
 */
public class FleetMdmClient {

    private static final String HOSTS_URL = "/api/v1/fleet/hosts";
    private static final String QUERIES_URL = "/api/v1/fleet/queries";
    private static final String POLICIES_URL = "/api/v1/fleet/global/policies";
    private static final String GET_ENROLL_SECRET_URL = "/api/latest/fleet/spec/enroll_secret";
    private static final String LIVE_QUERY_RUN_URL = "/api/v1/fleet/queries/run";
    private static final String POLICIES_DELETE_URL = "/api/v1/fleet/policies/delete";

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
        validateQuery(query);

        try {
            HttpRequest request = buildRunQueryRequest(hostId, query);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            checkRunQueryResponse(response, hostId);
            return parseQueryResult(response.body(), query);
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to execute query on host: " + hostId, e);
        }
    }

    /**
     * Same as {@link #runQuery} but uses non-blocking HTTP and returns a future.
     * Cancelling the future attempts to abort the in-flight request.
     */
    public CompletableFuture<QueryResult> runQueryAsync(long hostId, String query) {
        validateQuery(query);

        try {
            HttpRequest request = buildRunQueryRequest(hostId, query);

            return httpClient
                    .sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkRunQueryResponse(response, hostId);
                        try {
                            return parseQueryResult(response.body(), query);
                        } catch (Exception e) {
                            throw new FleetMdmException("Failed to parse query response for host: " + hostId, e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<QueryResult> failed = new CompletableFuture<>();
            failed.completeExceptionally(
                    new FleetMdmException("Failed to execute query on host: " + hostId, e));
            return failed;
        }
    }

    private static void validateQuery(String query) {
        if (query == null || query.trim().isEmpty()) {
            throw new IllegalArgumentException("Query cannot be null or empty");
        }
    }

    private HttpRequest buildRunQueryRequest(long hostId, String query) throws IOException {
        String requestBody = MAPPER.writeValueAsString(
                MAPPER.createObjectNode().put("query", query)
        );

        return addHeaders(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + HOSTS_URL + "/" + hostId + "/query"))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .header("Content-Type", "application/json"))
                .timeout(Duration.ofSeconds(90))
                .build();
    }

    private static void checkRunQueryResponse(HttpResponse<String> response, long hostId) {
        if (response.statusCode() == 401) {
            throw new FleetMdmApiException("Authentication failed. Please check your API token.", response.statusCode(), response.body());
        }
        if (response.statusCode() == 404) {
            throw new FleetMdmApiException("Host not found with ID: " + hostId, response.statusCode(), response.body());
        }
        if (response.statusCode() != 200) {
            throw new FleetMdmApiException("Failed to execute query", response.statusCode(), response.body());
        }
    }

    private static QueryResult parseQueryResult(String body, String query) throws IOException {
        QueryResult result = MAPPER.readValue(body, QueryResult.class);
        if (result.getQuery() == null) {
            result.setQuery(query);
        }
        return result;
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

    /**
     * Get a single policy by ID from Fleet MDM
     *
     * @param id Policy ID
     * @return Policy object or null if not found
     * @throws IOException if an I/O exception occurs
     * @throws InterruptedException if the request is interrupted
     * @throws FleetMdmApiException if the API returns an error
     */
    public Policy getPolicyById(long id) throws IOException, InterruptedException {
        HttpRequest request = addHeaders(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + POLICIES_URL + "/" + id)))
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 401) {
            throw new FleetMdmApiException("Authentication failed. Please check your API token.", response.statusCode(), response.body());
        } else if (response.statusCode() == 404) {
            return null; // Policy not found
        } else if (response.statusCode() != 200) {
            throw new FleetMdmApiException("Failed to fetch policy", response.statusCode(), response.body());
        }

        return MAPPER.treeToValue(MAPPER.readTree(response.body()).path("policy"), Policy.class);
    }

    /**
     * Create a global policy.
     */
    public Policy createPolicy(CreatePolicyRequest request) {
        try {
            HttpResponse<String> response = sendRequest(POLICIES_URL, "POST", MAPPER.writeValueAsString(request));
            checkResponse(response, "create Fleet policy");
            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to create Fleet policy", e);
        }
    }

    /**
     * List all global policies.
     */
    public List<Policy> listPolicies() {
        try {
            HttpResponse<String> response = sendRequest(POLICIES_URL, "GET", null);
            checkResponse(response, "list Fleet policies");
            return MAPPER.convertValue(
                    requireNode(response.body(), "policies"),
                    MAPPER.getTypeFactory().constructCollectionType(List.class, Policy.class));
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to list Fleet policies", e);
        }
    }

    /**
     * Get a policy by numeric ID.
     */
    public Policy getPolicy(long policyId) {
        try {
            HttpResponse<String> response = sendRequest(POLICIES_URL + "/" + policyId, "GET", null);
            checkResponse(response, "get Fleet policy");
            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to get Fleet policy: " + policyId, e);
        }
    }

    /**
     * Update an existing policy.
     */
    public Policy updatePolicy(long policyId, UpdatePolicyRequest request) {
        try {
            HttpResponse<String> response = sendRequest(POLICIES_URL + "/" + policyId, "PATCH", MAPPER.writeValueAsString(request));
            checkResponse(response, "update Fleet policy");
            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to update Fleet policy: " + policyId, e);
        }
    }

    /**
     * Create a scheduled query.
     */
    public Query createScheduledQuery(CreateScheduledQueryRequest request) {
        try {
            HttpResponse<String> response = sendRequest(QUERIES_URL, "POST", MAPPER.writeValueAsString(request));
            checkResponse(response, "create Fleet scheduled query");
            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to create Fleet scheduled query", e);
        }
    }

    /**
     * List all scheduled queries (interval > 0).
     */
    public List<Query> listScheduledQueries() {
        try {
            HttpResponse<String> response = sendRequest(QUERIES_URL, "GET", null);
            checkResponse(response, "list Fleet scheduled queries");
            return MAPPER.convertValue(
                    requireNode(response.body(), "queries"),
                    MAPPER.getTypeFactory().constructCollectionType(List.class, Query.class));
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to list Fleet scheduled queries", e);
        }
    }

    /**
     * Get a scheduled query by numeric ID.
     */
    public Query getScheduledQuery(long queryId) {
        try {
            HttpResponse<String> response = sendRequest(QUERIES_URL + "/" + queryId, "GET", null);
            checkResponse(response, "get Fleet scheduled query");
            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to get Fleet scheduled query: " + queryId, e);
        }
    }

    /**
     * Update an existing scheduled query.
     */
    public Query updateScheduledQuery(long queryId, UpdateScheduledQueryRequest request) {
        try {
            HttpResponse<String> response = sendRequest(QUERIES_URL + "/" + queryId, "PATCH", MAPPER.writeValueAsString(request));
            checkResponse(response, "update Fleet scheduled query");
            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to update Fleet scheduled query: " + queryId, e);
        }
    }

    public CompletableFuture<Policy> createPolicyAsync(CreatePolicyRequest request) {
        try {
            HttpRequest httpRequest = buildRequest(POLICIES_URL, "POST", MAPPER.writeValueAsString(request));
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkResponse(response, "create Fleet policy");
                        try {
                            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
                        } catch (Exception e) {
                            throw new FleetMdmException("Failed to parse create policy response", e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<Policy> failed = new CompletableFuture<>();
            failed.completeExceptionally(new FleetMdmException("Failed to create Fleet policy", e));
            return failed;
        }
    }

    public CompletableFuture<List<Policy>> listPoliciesAsync() {
        HttpRequest httpRequest = buildRequest(POLICIES_URL, "GET", null);
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkResponse(response, "list Fleet policies");
                    try {
                        return MAPPER.convertValue(
                                requireNode(response.body(), "policies"),
                                MAPPER.getTypeFactory().constructCollectionType(List.class, Policy.class));
                    } catch (Exception e) {
                        throw new FleetMdmException("Failed to parse list policies response", e);
                    }
                });
    }

    public CompletableFuture<Policy> getPolicyAsync(long policyId) {
        HttpRequest httpRequest = buildRequest(POLICIES_URL + "/" + policyId, "GET", null);
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkResponse(response, "get Fleet policy");
                    try {
                        return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
                    } catch (Exception e) {
                        throw new FleetMdmException("Failed to parse get policy response", e);
                    }
                });
    }

    public CompletableFuture<Policy> updatePolicyAsync(long policyId, UpdatePolicyRequest request) {
        try {
            HttpRequest httpRequest = buildRequest(POLICIES_URL + "/" + policyId, "PATCH", MAPPER.writeValueAsString(request));
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkResponse(response, "update Fleet policy");
                        try {
                            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
                        } catch (Exception e) {
                            throw new FleetMdmException("Failed to parse update policy response", e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<Policy> failed = new CompletableFuture<>();
            failed.completeExceptionally(new FleetMdmException("Failed to update Fleet policy: " + policyId, e));
            return failed;
        }
    }

    public CompletableFuture<Query> createScheduledQueryAsync(CreateScheduledQueryRequest request) {
        try {
            HttpRequest httpRequest = buildRequest(QUERIES_URL, "POST", MAPPER.writeValueAsString(request));
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkResponse(response, "create Fleet scheduled query");
                        try {
                            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
                        } catch (Exception e) {
                            throw new FleetMdmException("Failed to parse create scheduled query response", e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<Query> failed = new CompletableFuture<>();
            failed.completeExceptionally(new FleetMdmException("Failed to create Fleet scheduled query", e));
            return failed;
        }
    }

    public CompletableFuture<List<Query>> listScheduledQueriesAsync() {
        HttpRequest httpRequest = buildRequest(QUERIES_URL, "GET", null);
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkResponse(response, "list Fleet scheduled queries");
                    try {
                        return MAPPER.convertValue(
                                requireNode(response.body(), "queries"),
                                MAPPER.getTypeFactory().constructCollectionType(List.class, Query.class));
                    } catch (Exception e) {
                        throw new FleetMdmException("Failed to parse list scheduled queries response", e);
                    }
                });
    }

    public CompletableFuture<Query> getScheduledQueryAsync(long queryId) {
        HttpRequest httpRequest = buildRequest(QUERIES_URL + "/" + queryId, "GET", null);
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkResponse(response, "get Fleet scheduled query");
                    try {
                        return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
                    } catch (Exception e) {
                        throw new FleetMdmException("Failed to parse get scheduled query response", e);
                    }
                });
    }

    public CompletableFuture<Query> updateScheduledQueryAsync(long queryId, UpdateScheduledQueryRequest request) {
        try {
            HttpRequest httpRequest = buildRequest(QUERIES_URL + "/" + queryId, "PATCH", MAPPER.writeValueAsString(request));
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkResponse(response, "update Fleet scheduled query");
                        try {
                            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
                        } catch (Exception e) {
                            throw new FleetMdmException("Failed to parse update scheduled query response", e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<Query> failed = new CompletableFuture<>();
            failed.completeExceptionally(new FleetMdmException("Failed to update Fleet scheduled query: " + queryId, e));
            return failed;
        }
    }

    /**
     * Create a distributed live-query campaign that runs a query (ad-hoc or saved) on the targeted hosts.
     * Returns a campaign descriptor; results are streamed asynchronously over Fleet's live-query websocket.
     */
    public CompletableFuture<LiveQueryCampaign> runLiveQueryAsync(RunLiveQueryRequest request) {
        if (request == null) {
            CompletableFuture<LiveQueryCampaign> failed = new CompletableFuture<>();
            failed.completeExceptionally(new IllegalArgumentException("Live query request cannot be null"));
            return failed;
        }
        if ((request.getQuery() == null || request.getQuery().trim().isEmpty()) && request.getQueryId() == null) {
            CompletableFuture<LiveQueryCampaign> failed = new CompletableFuture<>();
            failed.completeExceptionally(new IllegalArgumentException("Live query request must specify either query or queryId"));
            return failed;
        }
        try {
            HttpRequest httpRequest = buildRequest(LIVE_QUERY_RUN_URL, "POST", MAPPER.writeValueAsString(request));
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkResponse(response, "create Fleet live-query campaign");
                        try {
                            return MAPPER.treeToValue(requireNode(response.body(), "campaign"), LiveQueryCampaign.class);
                        } catch (Exception e) {
                            throw new FleetMdmException("Failed to parse live-query campaign response", e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<LiveQueryCampaign> failed = new CompletableFuture<>();
            failed.completeExceptionally(new FleetMdmException("Failed to create Fleet live-query campaign", e));
            return failed;
        }
    }

    /**
     * Assign hosts to a saved query so the query targets them on its scheduled interval.
     * @return number of hosts added
     */
    public CompletableFuture<Long> addQueryHostsAsync(long queryId, List<Long> hostIds) {
        return modifyQueryHostsAsync(queryId, hostIds, "POST", "added");
    }

    /**
     * Unassign hosts from a saved query.
     * @return number of hosts removed
     */
    public CompletableFuture<Long> removeQueryHostsAsync(long queryId, List<Long> hostIds) {
        return modifyQueryHostsAsync(queryId, hostIds, "DELETE", "removed");
    }

    /**
     * Assign hosts to a global policy.
     * @return number of hosts added
     */
    public CompletableFuture<Long> addPolicyHostsAsync(long policyId, List<Long> hostIds) {
        return modifyPolicyHostsAsync(policyId, hostIds, "POST", "added");
    }

    /**
     * Unassign hosts from a global policy.
     * @return number of hosts removed
     */
    public CompletableFuture<Long> removePolicyHostsAsync(long policyId, List<Long> hostIds) {
        return modifyPolicyHostsAsync(policyId, hostIds, "DELETE", "removed");
    }

    /**
     * Delete a saved (scheduled) query by ID. Equivalent to DELETE /api/v1/fleet/queries/id/{id}.
     */
    public CompletableFuture<Void> deleteScheduledQueryAsync(long queryId) {
        HttpRequest httpRequest = buildRequest(QUERIES_URL + "/id/" + queryId, "DELETE", null);
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkResponse(response, "delete Fleet scheduled query: " + queryId);
                    return null;
                });
    }

    /**
     * Delete a global policy by ID. Uses Fleet's batch delete endpoint with a single-element list.
     */
    public CompletableFuture<Void> deletePolicyAsync(long policyId) {
        try {
            String body = MAPPER.writeValueAsString(MAPPER.createObjectNode()
                    .set("ids", MAPPER.createArrayNode().add(policyId)));
            HttpRequest httpRequest = buildRequest(POLICIES_DELETE_URL, "POST", body);
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkResponse(response, "delete Fleet policy: " + policyId);
                        return null;
                    });
        } catch (Exception e) {
            CompletableFuture<Void> failed = new CompletableFuture<>();
            failed.completeExceptionally(new FleetMdmException("Failed to delete Fleet policy: " + policyId, e));
            return failed;
        }
    }

    private CompletableFuture<Long> modifyQueryHostsAsync(long queryId, List<Long> hostIds, String method, String responseField) {
        return modifyAssociationAsync(QUERIES_URL + "/" + queryId + "/hosts", hostIds, method, responseField,
                "Fleet query hosts (queryId=" + queryId + ")");
    }

    private CompletableFuture<Long> modifyPolicyHostsAsync(long policyId, List<Long> hostIds, String method, String responseField) {
        return modifyAssociationAsync("/api/v1/fleet/policies/" + policyId + "/hosts", hostIds, method, responseField,
                "Fleet policy hosts (policyId=" + policyId + ")");
    }

    private CompletableFuture<Long> modifyAssociationAsync(String path, List<Long> hostIds, String method, String responseField, String contextLabel) {
        if (hostIds == null || hostIds.isEmpty()) {
            CompletableFuture<Long> failed = new CompletableFuture<>();
            failed.completeExceptionally(new IllegalArgumentException("hostIds must not be empty"));
            return failed;
        }
        try {
            String body = MAPPER.writeValueAsString(MAPPER.createObjectNode()
                    .set("host_ids", MAPPER.valueToTree(hostIds)));
            HttpRequest httpRequest = buildRequest(path, method, body);
            String action = ("POST".equals(method) ? "assign hosts to " : "remove hosts from ") + contextLabel;
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkResponse(response, action);
                        try {
                            JsonNode root = MAPPER.readTree(response.body());
                            JsonNode count = root.get(responseField);
                            return count != null && count.canConvertToLong() ? count.asLong() : 0L;
                        } catch (Exception e) {
                            throw new FleetMdmException("Failed to parse response for " + action, e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<Long> failed = new CompletableFuture<>();
            failed.completeExceptionally(new FleetMdmException("Failed to " + ("POST".equals(method) ? "assign" : "remove") + " hosts on " + contextLabel, e));
            return failed;
        }
    }

    private HttpRequest buildRequest(String path, String method, String body) {
        HttpRequest.Builder builder = addHeaders(HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .header("Content-Type", "application/json"))
                .timeout(Duration.ofSeconds(30));
        switch (method) {
            case "POST"  -> builder.POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : body));
            case "PATCH" -> builder.method("PATCH", HttpRequest.BodyPublishers.ofString(body == null ? "" : body));
            case "DELETE" -> {
                if (body == null) {
                    builder.DELETE();
                } else {
                    builder.method("DELETE", HttpRequest.BodyPublishers.ofString(body));
                }
            }
            default      -> builder.GET();
        }
        return builder.build();
    }

    private HttpResponse<String> sendRequest(String path, String method, String body) throws Exception {
        return httpClient.send(buildRequest(path, method, body), HttpResponse.BodyHandlers.ofString());
    }

    private static void checkResponse(HttpResponse<String> response, String action) {
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            return;
        }
        String body = response.body() == null ? "" : response.body().trim();
        throw new FleetMdmApiException(action + " failed with HTTP " + response.statusCode()
                + (body.isEmpty() ? "" : ": " + body), response.statusCode(), body);
    }

    private static JsonNode requireNode(String responseBody, String fieldName) throws Exception {
        JsonNode root = MAPPER.readTree(responseBody);
        JsonNode node = root.get(fieldName);
        if (node == null || node.isNull()) {
            throw new FleetMdmException("Fleet response missing field \"" + fieldName + "\". Body: " + responseBody);
        }
        return node;
    }

    private HttpRequest.Builder addHeaders(HttpRequest.Builder builder) {
        return builder
                .header("Authorization", "Bearer " + apiToken)
                .header("Accept", "application/json");
    }
}
