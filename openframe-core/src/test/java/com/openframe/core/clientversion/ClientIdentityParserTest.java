package com.openframe.core.clientversion;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ClientIdentityParserTest {

    @ParameterizedTest
    @CsvSource({
            "ios/1.0.1 bundle/1.0.127,                  IOS,     1.0.1, 1.0.127",
            "android/1.0.1 bundle/1.0.127,              ANDROID, 1.0.1, 1.0.127",
            "web/- bundle/1.0.127,                      WEB,     -,     1.0.127",
            "desktop/0.4.2 bundle/1.0.127,              DESKTOP, 0.4.2, 1.0.127",
            "chat/1.5.107 bundle/1.5.107,               CHAT,    1.5.107, 1.5.107",
            "ios/- bundle/1.0.130,                      IOS,     -,     1.0.130",
            "ios/1.0.1 bundle/-,                        IOS,     1.0.1, -",
            "ios/1.0.1 bundle/1.0.125-4-geae0416-dirty, IOS,     1.0.1, 1.0.125-4-geae0416-dirty"
    })
    void parse_wellFormedHeader_kindAndVersionsRead(String header, ClientKind kind, String shell, String bundle) {
        // setup - header prepared by the source

        // execution
        ClientIdentity identity = ClientIdentityParser.parse(header);

        // verifications
        assertThat(identity)
                .extracting(ClientIdentity::getKind, ClientIdentity::getShellVersion, ClientIdentity::getBundleVersion)
                .containsExactly(kind, shell, bundle);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "ios", "ios/1.0.1", "ios/1.0.1 1.0.127", "IOS/1.0.1 bundle/1.0.127",
            "ios/1.0.1 bundle/1.0.127 extra", "/1.0.1 bundle/1.0.127"})
    void parse_malformedHeader_unknownIdentityReturned(String header) {
        // setup - header prepared by the source

        // execution
        ClientIdentity identity = ClientIdentityParser.parse(header);

        // verifications
        assertThat(identity)
                .extracting(ClientIdentity::getKind, ClientIdentity::getShellVersion, ClientIdentity::getBundleVersion)
                .containsExactly(ClientKind.UNKNOWN, "-", "-");
    }

    @Test
    void parse_wellFormedHeader_identityPrintsAllFields() {
        // setup - literal header

        // execution
        ClientIdentity identity = ClientIdentityParser.parse("ios/1.0.1 bundle/1.0.127");

        // verifications
        assertThat(identity).hasToString("ClientIdentity(kind=IOS, shellVersion=1.0.1, bundleVersion=1.0.127)");
    }

    @ParameterizedTest
    @ValueSource(strings = {"tv/1.0.1 bundle/1.0.127", "fridge/- bundle/1.0.127"})
    void parse_kindOutsideFixedList_kindIsUnknown(String header) {
        // setup - header prepared by the source

        // execution
        ClientIdentity identity = ClientIdentityParser.parse(header);

        // verifications
        assertThat(identity.getKind()).isEqualTo(ClientKind.UNKNOWN);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "ios/1.0.1 bundle/1.0_127",
            "ios/1.0.1 bundle/1.0.127+build",
            "ios/1.0.1 bundle/123456789012345678901234567890123"
    })
    void parse_bundleVersionFailsPattern_bundleVersionIsDash(String header) {
        // setup - header prepared by the source

        // execution
        ClientIdentity identity = ClientIdentityParser.parse(header);

        // verifications
        assertThat(identity)
                .extracting(ClientIdentity::getKind, ClientIdentity::getBundleVersion)
                .containsExactly(ClientKind.IOS, "-");
    }
}
