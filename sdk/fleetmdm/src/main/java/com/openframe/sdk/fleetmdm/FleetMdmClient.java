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
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import com.openframe.sdk.fleetmdm.model.VulnerabilitiesResponse;
import com.openframe.sdk.fleetmdm.model.Vulnerability;
import com.openframe.sdk.fleetmdm.model.VulnerabilityRequest;

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
    private static final String POLICIES_DELETE_URL = "/api/latest/fleet/policies/delete";
    private static final String VULNERABILITIES_URL = "/api/latest/fleet/vulnerabilities";
    private static final String SOFTWARE_TITLES_URL = "/api/latest/fleet/software/titles";
    private static final String VULNERABILITY_DETAIL_URL = "/api/latest/fleet/vulnerabilities/";

    static final String TENANT_ID_HEADER = "X-Tenant-Id";

    private final String baseUrl;
    private final String apiToken;
    private final String tenantId;
    private final HttpClient httpClient;

    /**
     * Thread-safe reusable {@link ObjectMapper}. Creating it once is cheaper than instantiating a new one
     * every request.
     */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Body of a Fleet API call. It may throw checked exceptions so the call sites keep plain
     * request/parse code and the wrapping lives in exactly one place.
     */
    @FunctionalInterface
    private interface FleetCall<T> {
        T execute() throws Exception;
    }

    /**
     * The single place where a failed Fleet call becomes an unchecked {@link FleetMdmException}.
     *
     * <p>{@link FleetMdmApiException} keeps its own type so callers can still react to an HTTP
     * status. An interrupt re-arms the thread's interrupt flag before wrapping: once the checked
     * {@code InterruptedException} is gone from the signature, that flag is the only thing left
     * telling the caller that its thread is being shut down.
     *
     * @param action what the call was trying to do, phrased to follow "Failed to" /
     *               "Interrupted while trying to" (e.g. {@code "fetch Fleet query 7"})
     */
    private <T> T call(String action, FleetCall<T> body) {
        try {
            return body.execute();
        } catch (FleetMdmApiException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FleetMdmException("Interrupted while trying to " + action, e);
        } catch (FleetMdmException e) {
            throw e;
        } catch (Exception e) {
            throw new FleetMdmException("Failed to " + action, e);
        }
    }

    /**
     * Constructor intended for unit-tests – allows passing a pre-configured or mocked {@link HttpClient}.
     */
    FleetMdmClient(String baseUrl, String apiToken, HttpClient httpClient) {
        this(baseUrl, apiToken, null, httpClient);
    }

    FleetMdmClient(String baseUrl, String apiToken, String tenantId, HttpClient httpClient) {
        this.baseUrl  = baseUrl;
        this.apiToken = apiToken;
        this.tenantId = tenantId;
        this.httpClient = httpClient;
    }

    /**
     * @param baseUrl  Base URL of Fleet MDM (e.g., https://fleet.example.com)
     * @param apiToken API token for authorization
     */
    public FleetMdmClient(String baseUrl, String apiToken) {
        this(baseUrl, apiToken, (String) null);
    }

    public FleetMdmClient(String baseUrl, String apiToken, String tenantId) {
        this.baseUrl = baseUrl;
        this.apiToken = apiToken;
        this.tenantId = tenantId;
        this.httpClient = HttpClient.newHttpClient();
    }

    /**
     * Get a single host by ID from Fleet MDM
     * @param id Host ID
     * @return Host object or null if not found
     */
    public Host getHostById(long id) {
        return call("fetch Fleet host " + id, () -> {
            HttpRequest request = addHeaders(HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + HOSTS_URL + "/" + id)))
                    .GET()
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new FleetMdmApiException("Authentication failed. Please check your API token.", response.statusCode(), response.body());
            } else if (response.statusCode() == 404) {
                return null; // Host not found
            } else if (response.statusCode() != 200) {
                throw new FleetMdmApiException("Failed to fetch host", response.statusCode(), response.body());
            }

            return MAPPER.treeToValue(MAPPER.readTree(response.body()).path("host"), Host.class);
        });
    }

    /**
     * Search for hosts using the provided query parameters
     * @param searchRequest Search parameters including query string, page, and per_page
     * @return List of matching Host objects
     * @throws FleetMdmApiException if the API returns an error
     * @throws FleetMdmException if the call fails or the thread is interrupted
     */
    public List<Host> searchHosts(HostSearchRequest searchRequest) {
        if (searchRequest == null) {
            throw new IllegalArgumentException("Search request cannot be null");
        }

        return call("process host search request", () -> {
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
        });
    }

    /**
     * Search for hosts by query string with default pagination
     * @param query Search query (e.g., hostname, UUID, IP address)
     * @return List of matching Host objects
     * @throws FleetMdmApiException if the API returns an error
     * @throws FleetMdmException if the call fails or the thread is interrupted
     */
    public List<Host> searchHosts(String query) {
        return searchHosts(new HostSearchRequest(query));
    }

    /**
     * Search for hosts by query string with custom pagination
     * @param query Search query (e.g., hostname, UUID, IP address)
     * @param page Page number (0-based)
     * @param perPage Number of results per page
     * @return List of matching Host objects
     * @throws FleetMdmApiException if the API returns an error
     * @throws FleetMdmException if the call fails or the thread is interrupted
     */
    public List<Host> searchHosts(String query, Integer page, Integer perPage) {
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
     * @throws FleetMdmApiException if the API returns an error
     * @throws FleetMdmException if the call fails or the thread is interrupted
     */
    public QueryResult runQuery(long hostId, String query) {
        validateQuery(query);

        return call("execute query on host: " + hostId, () -> {
            HttpRequest request = buildRunQueryRequest(hostId, query);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            checkRunQueryResponse(response, hostId);
            return parseQueryResult(response.body(), query);
        });
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
        return call("process get enroll secret request", () -> {
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
        });
    }

    /**
     * Get a single query by ID from Fleet MDM
     *
     * @param id Query ID
     * @return Query object or null if not found
     * @throws FleetMdmApiException if the API returns an error
     * @throws FleetMdmException if the call fails or the thread is interrupted
     */
    public Query getQueryById(long id) {
        return call("fetch Fleet query " + id, () -> {
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
        });
    }

    /**
     * Get a single policy by ID from Fleet MDM
     *
     * @param id Policy ID
     * @return Policy object or null if not found
     * @throws FleetMdmApiException if the API returns an error
     * @throws FleetMdmException if the call fails or the thread is interrupted
     */
    public Policy getPolicyById(long id) {
        return call("fetch Fleet policy " + id, () -> {
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
        });
    }

    /**
     * Create a global policy.
     */
    public Policy createPolicy(CreatePolicyRequest request) {
        return call("create Fleet policy", () -> {
            HttpResponse<String> response = sendRequest(POLICIES_URL, "POST", MAPPER.writeValueAsString(request));
            checkResponse(response, "create Fleet policy");
            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
        });
    }

    public SoftwareTitlesResponse listSoftwareTitles(SoftwareTitleRequest request) throws IOException, InterruptedException {
        HttpResponse<String> response = sendRequest(buildSoftwareTitlesQuery(request), "GET", null);
        checkResponse(response, "list Fleet software titles");
        return MAPPER.readValue(response.body(), SoftwareTitlesResponse.class);
    }

    public SoftwareTitle getSoftwareTitle(long id) throws IOException, InterruptedException {
        HttpResponse<String> response = sendRequest(SOFTWARE_TITLES_URL + "/" + id, "GET", null);
        if (response.statusCode() == 404) {
            return null;
        }
        checkResponse(response, "get Fleet software title");
        return MAPPER.treeToValue(requireNode(response.body(), "software_title"), SoftwareTitle.class);
    }

    public Vulnerability getVulnerability(String cve) throws IOException, InterruptedException {
        HttpResponse<String> response = sendRequest(VULNERABILITY_DETAIL_URL + URLEncoder.encode(cve, StandardCharsets.UTF_8),
                "GET", null);
        if (response.statusCode() == 404) {
            return null;
        }
        checkResponse(response, "get Fleet vulnerability");
        return MAPPER.treeToValue(requireNode(response.body(), "vulnerability"), Vulnerability.class);
    }

    private static String buildSoftwareTitlesQuery(SoftwareTitleRequest request) {
        StringBuilder url = new StringBuilder(SOFTWARE_TITLES_URL);
        List<String> params = new ArrayList<>();
        if (request != null) {
            if (request.getPage() != null) {
                params.add("page=" + request.getPage());
            }
            if (request.getPerPage() != null) {
                params.add("per_page=" + request.getPerPage());
            }
            if (request.getQuery() != null && !request.getQuery().isBlank()) {
                params.add("query=" + URLEncoder.encode(request.getQuery(), StandardCharsets.UTF_8));
            }
            if (request.getOrderKey() != null && !request.getOrderKey().isBlank()) {
                params.add("order_key=" + URLEncoder.encode(request.getOrderKey(), StandardCharsets.UTF_8));
            }
            if (request.getOrderDirection() != null && !request.getOrderDirection().isBlank()) {
                params.add("order_direction=" + URLEncoder.encode(request.getOrderDirection(), StandardCharsets.UTF_8));
            }
            if (Boolean.TRUE.equals(request.getVulnerable())) {
                params.add("vulnerable=true");
            }
        }
        if (!params.isEmpty()) {
            url.append("?").append(String.join("&", params));
        }
        return url.toString();
    }

    public VulnerabilitiesResponse listVulnerabilities(int page, int perPage) {
        try {
            return listVulnerabilities(VulnerabilityRequest.builder().page(page).perPage(perPage).build());
        } catch (IOException e) {
            throw new FleetMdmException("Failed to list Fleet vulnerabilities", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FleetMdmException("Interrupted while listing Fleet vulnerabilities", e);
        }
    }

    public VulnerabilitiesResponse listVulnerabilities(VulnerabilityRequest request) throws IOException, InterruptedException {
        HttpResponse<String> response = sendRequest(buildVulnerabilitiesQuery(request), "GET", null);
        checkResponse(response, "list Fleet vulnerabilities");
        return MAPPER.readValue(response.body(), VulnerabilitiesResponse.class);
    }

    private static String buildVulnerabilitiesQuery(VulnerabilityRequest request) {
        StringBuilder url = new StringBuilder(VULNERABILITIES_URL);
        List<String> params = new ArrayList<>();
        if (request != null) {
            if (request.getPage() != null) {
                params.add("page=" + request.getPage());
            }
            if (request.getPerPage() != null) {
                params.add("per_page=" + request.getPerPage());
            }
            if (request.getQuery() != null && !request.getQuery().isBlank()) {
                params.add("query=" + URLEncoder.encode(request.getQuery(), StandardCharsets.UTF_8));
            }
            if (request.getOrderKey() != null && !request.getOrderKey().isBlank()) {
                params.add("order_key=" + URLEncoder.encode(request.getOrderKey(), StandardCharsets.UTF_8));
            }
            if (request.getOrderDirection() != null && !request.getOrderDirection().isBlank()) {
                params.add("order_direction=" + URLEncoder.encode(request.getOrderDirection(), StandardCharsets.UTF_8));
            }
            if (Boolean.TRUE.equals(request.getExploit())) {
                params.add("exploit=true");
            }
        }
        if (!params.isEmpty()) {
            url.append("?").append(String.join("&", params));
        }
        return url.toString();
    }

    public List<Policy> listPolicies() {
        return call("list Fleet policies", () -> {
            HttpResponse<String> response = sendRequest(POLICIES_URL, "GET", null);
            checkResponse(response, "list Fleet policies");
            return MAPPER.convertValue(
                    listNodeOrEmpty(response.body(), "policies"),
                    MAPPER.getTypeFactory().constructCollectionType(List.class, Policy.class));
        });
    }

    public Policy getPolicy(long policyId) {
        return call("get Fleet policy: " + policyId, () -> {
            HttpResponse<String> response = sendRequest(POLICIES_URL + "/" + policyId, "GET", null);
            checkResponse(response, "get Fleet policy");
            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
        });
    }

    public Policy updatePolicy(long policyId, UpdatePolicyRequest request) {
        return call("update Fleet policy: " + policyId, () -> {
            HttpResponse<String> response = sendRequest(POLICIES_URL + "/" + policyId, "PATCH", MAPPER.writeValueAsString(request));
            checkResponse(response, "update Fleet policy");
            return MAPPER.treeToValue(requireNode(response.body(), "policy"), Policy.class);
        });
    }

    public Query createScheduledQuery(CreateScheduledQueryRequest request) {
        return call("create Fleet scheduled query", () -> {
            HttpResponse<String> response = sendRequest(QUERIES_URL, "POST", MAPPER.writeValueAsString(request));
            checkResponse(response, "create Fleet scheduled query");
            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
        });
    }

    public List<Query> listScheduledQueries() {
        return call("list Fleet scheduled queries", () -> {
            HttpResponse<String> response = sendRequest(QUERIES_URL, "GET", null);
            checkResponse(response, "list Fleet scheduled queries");
            return MAPPER.convertValue(
                    listNodeOrEmpty(response.body(), "queries"),
                    MAPPER.getTypeFactory().constructCollectionType(List.class, Query.class));
        });
    }

    public Query getScheduledQuery(long queryId) {
        return call("get Fleet scheduled query: " + queryId, () -> {
            HttpResponse<String> response = sendRequest(QUERIES_URL + "/" + queryId, "GET", null);
            checkResponse(response, "get Fleet scheduled query");
            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
        });
    }

    public Query updateScheduledQuery(long queryId, UpdateScheduledQueryRequest request) {
        return call("update Fleet scheduled query: " + queryId, () -> {
            HttpResponse<String> response = sendRequest(QUERIES_URL + "/" + queryId, "PATCH", MAPPER.writeValueAsString(request));
            checkResponse(response, "update Fleet scheduled query");
            return MAPPER.treeToValue(requireNode(response.body(), "query"), Query.class);
        });
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
                                listNodeOrEmpty(response.body(), "policies"),
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
                                listNodeOrEmpty(response.body(), "queries"),
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

    private HttpResponse<String> sendRequest(String path, String method, String body) throws IOException, InterruptedException {
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

    private static JsonNode listNodeOrEmpty(String responseBody, String fieldName) throws IOException {
        JsonNode root = MAPPER.readTree(responseBody);
        JsonNode node = root.get(fieldName);
        if (node == null || node.isNull()) {
            return MAPPER.createArrayNode();
        }
        return node;
    }

    private static JsonNode requireNode(String responseBody, String fieldName) throws IOException {
        JsonNode root = MAPPER.readTree(responseBody);
        JsonNode node = root.get(fieldName);
        if (node == null || node.isNull()) {
            throw new FleetMdmException("Fleet response missing field \"" + fieldName + "\". Body: " + responseBody);
        }
        return node;
    }

    private HttpRequest.Builder addHeaders(HttpRequest.Builder builder) {
        builder
                .header("Authorization", "Bearer " + apiToken)
                .header("Accept", "application/json");
        if (tenantId != null && !tenantId.isBlank()) {
            builder.header(TENANT_ID_HEADER, tenantId);
        }
        return builder;
    }
}
