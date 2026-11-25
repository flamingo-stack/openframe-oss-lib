package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmNotFoundException;
import com.openframe.sdk.fleetmdm.model.WindowsWipeType;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientWipeTest {

    @Mock private HttpClient httpClient;
    @Mock private HttpResponse<String> httpResponse;

    @Test
    void wipeHost_postsWindowsWipeTypeToHostWipeEndpoint() throws Exception {
        // setup
        stubStatus(200);
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution
        client.wipeHost(42L, WindowsWipeType.DO_WIPE_PROTECTED);

        // verifications
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(captor.capture(), any());
        HttpRequest request = captor.getValue();
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.uri()).hasToString("https://fleet.example.com/api/v1/fleet/hosts/42/wipe");
        assertThat(bodyOf(request)).isEqualTo("{\"windows\":{\"wipe_type\":\"doWipeProtected\"}}");
    }

    @Test
    void wipeHost_foreignOrMissingHost_throwsNotFound() throws Exception {
        // setup
        stubResponse(404, "{\"message\":\"Resource Not Found\"}");
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution / verifications
        assertThatThrownBy(() -> client.wipeHost(42L, WindowsWipeType.DO_WIPE))
                .isInstanceOf(FleetMdmNotFoundException.class);
    }

    @Test
    void wipeHost_refusedByFleet_keepsStatusAndBody() throws Exception {
        // setup
        String body = "{\"message\":\"Validation Failed\",\"errors\":[{\"name\":\"host_id\","
                + "\"reason\":\"Can't wipe the host because it doesn't have MDM turned on.\"}]}";
        stubResponse(422, body);
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution / verifications
        assertThatThrownBy(() -> client.wipeHost(42L, WindowsWipeType.DO_WIPE_PROTECTED))
                .isInstanceOfSatisfying(FleetMdmApiException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(422);
                    assertThat(e.getResponseBody()).isEqualTo(body);
                    assertThat(e.getReason()).isEqualTo("Can't wipe the host because it doesn't have MDM turned on.");
                });
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
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        CompletableFuture<Void> done = new CompletableFuture<>();
        request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<>() {
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
