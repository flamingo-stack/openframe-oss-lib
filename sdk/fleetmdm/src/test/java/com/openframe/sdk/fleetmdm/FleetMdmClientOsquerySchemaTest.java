package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.model.OsquerySchemaSearchRequest;
import com.openframe.sdk.fleetmdm.model.OsquerySchemaSearchResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientOsquerySchemaTest {

    private static final String BASE_URL = "https://fleet.example.com";
    private static final String API_TOKEN = "token";
    private static final String TENANT_ID = "tenant-1";
    private static final String RESPONSE_BODY = """
            {
              "query": "windows update result code",
              "platform": "windows",
              "count": 1,
              "tables": [
                {
                  "name": "windows_update_history",
                  "platforms": ["windows"],
                  "description": "Windows update history.",
                  "columns": [
                    {
                      "name": "result_code",
                      "type": "text",
                      "description": "Update result code.",
                      "notes": "Use hexadecimal values.",
                      "platforms": ["windows"],
                      "required": true,
                      "hidden": null,
                      "index": true
                    }
                  ],
                  "examples": "SELECT result_code FROM windows_update_history;",
                  "notes": null,
                  "url": "https://fleetdm.com/tables/windows_update_history",
                  "evented": true,
                  "cacheable": false
                }
              ]
            }
            """;

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    @Captor
    private ArgumentCaptor<HttpRequest> requestCaptor;

    private FleetMdmClient client;

    @BeforeEach
    void setUp() {
        client = new FleetMdmClient(BASE_URL, API_TOKEN, TENANT_ID, httpClient);
    }

    @Test
    void searchOsquerySchema_suppliedFilters_sendsAuthenticatedGetAndParsesSchema() throws Exception {
        // setup
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(RESPONSE_BODY);
        when(httpClient.send(
                any(HttpRequest.class),
                ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(httpResponse);
        OsquerySchemaSearchRequest searchRequest =
                new OsquerySchemaSearchRequest("windows update result code", "windows", 5);

        // execution
        OsquerySchemaSearchResponse response = client.searchOsquerySchema(searchRequest);

        // verifications
        verify(httpClient).send(
                requestCaptor.capture(),
                ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
        HttpRequest request = requestCaptor.getValue();
        assertThat(request.method()).isEqualTo("GET");
        assertThat(request.uri()).hasToString(
                "https://fleet.example.com/api/v1/fleet/osquery/schema/search"
                        + "?query=windows+update+result+code&platform=windows&limit=5");
        assertThat(request.headers().allValues("Authorization")).containsExactly("Bearer " + API_TOKEN);
        assertThat(request.headers().allValues(FleetMdmClient.TENANT_ID_HEADER)).containsExactly(TENANT_ID);
        assertThat(response.getQuery()).isEqualTo("windows update result code");
        assertThat(response.getPlatform()).isEqualTo("windows");
        assertThat(response.getCount()).isEqualTo(1);
        assertThat(response.getTables())
                .extracting(
                        table -> table.getName(),
                        table -> table.isEvented(),
                        table -> table.isCacheable(),
                        table -> table.getExamples(),
                        table -> table.getNotes())
                .containsExactly(tuple(
                        "windows_update_history",
                        true,
                        false,
                        "SELECT result_code FROM windows_update_history;",
                        null));
        assertThat(response.getTables())
                .flatExtracting(table -> table.getColumns())
                .extracting(
                        column -> column.getName(),
                        column -> column.getType(),
                        column -> column.getPlatforms(),
                        column -> column.getNotes(),
                        column -> column.isRequired(),
                        column -> column.getHidden(),
                        column -> column.getIndex())
                .containsExactly(tuple(
                        "result_code",
                        "text",
                        List.of("windows"),
                        "Use hexadecimal values.",
                        true,
                        null,
                        true));
    }

    @Test
    void searchOsquerySchema_optionalFiltersOmitted_sendsOnlyQuery() throws Exception {
        // setup
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"query\":\"processes\",\"platform\":\"all\",\"count\":0,\"tables\":[]}");
        when(httpClient.send(
                any(HttpRequest.class),
                ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(httpResponse);
        FleetMdmClient clientWithoutTenant = new FleetMdmClient(BASE_URL, API_TOKEN, httpClient);
        OsquerySchemaSearchRequest searchRequest = new OsquerySchemaSearchRequest("processes", null, null);

        // execution
        clientWithoutTenant.searchOsquerySchema(searchRequest);

        // verifications
        verify(httpClient).send(
                requestCaptor.capture(),
                ArgumentMatchers.<HttpResponse.BodyHandler<String>>any());
        assertThat(requestCaptor.getValue().uri()).hasToString(
                "https://fleet.example.com/api/v1/fleet/osquery/schema/search?query=processes");
    }

    @Test
    void searchOsquerySchema_validationResponse_throwsFleetMdmApiException() throws Exception {
        // setup
        when(httpResponse.statusCode()).thenReturn(400);
        when(httpResponse.body()).thenReturn("{\"message\":\"query must not be empty\"}");
        when(httpClient.send(
                any(HttpRequest.class),
                ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(httpResponse);
        OsquerySchemaSearchRequest searchRequest = new OsquerySchemaSearchRequest(" ", null, null);

        // execution
        FleetMdmApiException exception = assertThrows(
                FleetMdmApiException.class,
                () -> client.searchOsquerySchema(searchRequest));

        // verifications
        assertThat(exception.getStatusCode()).isEqualTo(400);
        assertThat(exception.getMessage()).contains("search Fleet osquery schema failed with HTTP 400");
    }
}
