package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientHostSoftwareTest {

    @Mock private HttpClient httpClient;
    @Mock private HttpResponse<String> httpResponse;

    @Test
    void listHostSoftware_macApp_bundleIdentifierAndInstalledPathsRead() throws Exception {
        // setup
        stubResponse("""
                {
                  "software": [
                    {"id": 42, "name": "Code", "source": "apps", "bundle_identifier": "com.microsoft.VSCode",
                     "installed_versions": [
                       {"version": "1.95.0", "bundle_identifier": "com.microsoft.VSCode",
                        "installed_paths": ["/Applications/Visual Studio Code.app"],
                        "signature_information": [{"installed_path": "/Applications/Visual Studio Code.app",
                                                   "team_identifier": "UBF8T346G9"}]}
                     ]}
                  ],
                  "meta": {"has_next_results": false}
                }
                """);
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution
        HostSoftwareResponse response = client.listHostSoftware(7L, 0, 100);

        // verifications
        List<HostSoftwareTitle> titles = response.getSoftware();
        assertThat(titles)
                .extracting(HostSoftwareTitle::getBundleIdentifier)
                .containsExactly("com.microsoft.VSCode");
        assertThat(titles)
                .flatExtracting(HostSoftwareTitle::getInstalledVersions)
                .extracting(HostSoftwareInstalledVersion::getInstalledPaths)
                .containsExactly(List.of("/Applications/Visual Studio Code.app"));
    }

    @Test
    void listHostSoftware_versionWithoutInstalledPaths_pathsNull() throws Exception {
        // setup
        stubResponse("""
                {"software": [{"id": 43, "name": "jq", "source": "homebrew_packages",
                               "installed_versions": [{"version": "1.7"}]}]}
                """);
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution
        HostSoftwareResponse response = client.listHostSoftware(7L, 0, 100);

        // verifications
        assertThat(response.getSoftware())
                .flatExtracting(HostSoftwareTitle::getInstalledVersions)
                .extracting(HostSoftwareInstalledVersion::getInstalledPaths)
                .containsOnlyNulls();
    }

    private void stubResponse(String body) throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(body);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);
    }
}
