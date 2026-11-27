package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmArgumentException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientWindowsMdmServerUrlTest {

    @Mock private HttpClient httpClient;
    @Mock private HttpResponse<String> httpResponse;

    @Test
    void setWindowsMdmServerUrl_patchesOnlyTheWindowsAddressOfTheTenantConfig() throws Exception {
        // setup
        stubStatus(200);
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", "tenant-1", httpClient);

        // execution
        client.setWindowsMdmServerUrl("https://acme.openframe.ai/mdm");

        // verifications
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(captor.capture(), any());
        HttpRequest request = captor.getValue();
        assertThat(request.method()).isEqualTo("PATCH");
        assertThat(request.uri()).hasToString("https://fleet.example.com/api/latest/fleet/config");
        assertThat(request.headers().firstValue("X-Tenant-Id")).hasValue("tenant-1");
        assertThat(bodyOf(request)).isEqualTo("{\"mdm\":{\"windows_server_url\":\"https://acme.openframe.ai/mdm\"}}");
    }

    @Test
    void setWindowsMdmServerUrl_refusedByFleet_keepsStatusAndReason() throws Exception {
        // setup
        String body = "{\"message\":\"Validation Failed\",\"errors\":[{\"name\":\"base\","
                + "\"reason\":\"unsupported key provided: \\\"windows_server_url\\\"\"}]}";
        stubResponse(400, body);
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", "tenant-1", httpClient);

        // execution / verifications
        assertThatThrownBy(() -> client.setWindowsMdmServerUrl("https://acme.openframe.ai/mdm"))
                .isInstanceOfSatisfying(FleetMdmApiException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(400);
                    assertThat(e.getReason()).isEqualTo("unsupported key provided: \"windows_server_url\"");
                });
    }

    @Test
    void setWindowsMdmServerUrl_blank_isRejectedWithoutACall() {
        // setup
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", "tenant-1", httpClient);

        // execution / verifications
        assertThatThrownBy(() -> client.setWindowsMdmServerUrl(" "))
                .isInstanceOf(FleetMdmArgumentException.class);
        verifyNoInteractions(httpClient);
    }

    private void stubResponse(int status, String body) throws Exception {
        when(httpResponse.body()).thenReturn(body);
        stubStatus(status);
    }

    private void stubStatus(int status) throws Exception {
        when(httpResponse.statusCode()).thenReturn(status);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);
    }

    private static String bodyOf(HttpRequest request) throws Exception {
        HttpRequest.BodyPublisher publisher = request.bodyPublisher().orElseThrow();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CompletableFuture<Void> done = new CompletableFuture<>();
        publisher.subscribe(new Flow.Subscriber<>() {
            @Override
            public void onSubscribe(Flow.Subscription subscription) {
                subscription.request(Long.MAX_VALUE);
            }

            @Override
            public void onNext(ByteBuffer item) {
                byte[] bytes = new byte[item.remaining()];
                item.get(bytes);
                out.writeBytes(bytes);
            }

            @Override
            public void onError(Throwable throwable) {
                done.completeExceptionally(throwable);
            }

            @Override
            public void onComplete() {
                done.complete(null);
            }
        });
        done.get();
        return out.toString(StandardCharsets.UTF_8);
    }
}
