package com.openframe.test.api;

import io.restassured.http.ContentType;

import static com.openframe.test.helpers.RequestSpecHelper.getUnAuthorizedSpec;
import static io.restassured.RestAssured.given;

/**
 * Mints an AGENT access token the same way an installed agent does: {@code POST clients/oauth/token}
 * with the {@code client_credentials} grant.
 *
 * <p>The gateway routes {@code /clients/**} to openframe-client with {@code StripPrefix=1}, so this
 * reaches that service's {@code /oauth/token}. The issued token carries a {@code machine_id} claim
 * taken from the machine's {@code OAuthClient} record — that claim is the <em>only</em> thing that
 * targets the client assistant at a machine (see {@code MachineIdResolverService}, AGENT branch), which
 * is why obtaining a real one is the precondition for every Fae case.
 *
 * <p>The endpoint takes form parameters, not JSON, and is unauthenticated — the client credentials
 * <em>are</em> the authentication.
 */
public class AgentAuthApi {

    private static final String TOKEN = "clients/oauth/token";

    private static final String CLIENT_CREDENTIALS = "client_credentials";

    /**
     * The platform firewall in front of the {@code /clients/**} route drops requests that do not carry
     * it (403 before the request reaches openframe-client). The installed agent sends it on every HTTP
     * call since the machine-id firewall change (#1688); anything imitating the agent must too.
     */
    static final String MACHINE_ID_HEADER = "x-machine-id";

    /**
     * Exchanges a machine's client credentials for an AGENT access token.
     *
     * @param machineId the machine the credentials belong to; sent as {@value #MACHINE_ID_HEADER} so the
     *                  firewall lets the request through. Any well-formed id satisfies the edge; the
     *                  server-assigned one from the agent config is the natural choice.
     * @return the raw access token, ready for {@code RequestSpecHelper.setBearerToken}
     */
    public static String getClientCredentialsToken(String machineId, String clientId, String clientSecret) {
        return given(getUnAuthorizedSpec())
                .header(MACHINE_ID_HEADER, machineId)
                .contentType(ContentType.URLENC)
                .formParam("grant_type", CLIENT_CREDENTIALS)
                .formParam("client_id", clientId)
                .formParam("client_secret", clientSecret)
                .post(TOKEN)
                .then().statusCode(200)
                .extract().jsonPath().getString("accessToken");
    }
}
