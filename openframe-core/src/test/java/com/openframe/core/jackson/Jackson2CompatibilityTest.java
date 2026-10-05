package com.openframe.core.jackson;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class Jackson2CompatibilityTest {

    private static final String BODY_WITHOUT_PRIMITIVES = "{\"id\":\"c-1\",\"archived\":null}";

    record Contact(String id, boolean archived, int score) {
    }

    @Test
    void shouldLetARestClientReadAResponseWithMissingAndNullPrimitives() {
        RestClient.Builder builder = RestClient.builder()
                .configureMessageConverters(Jackson2Compatibility::restClientConverters);
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("/contacts/c-1")).andRespond(withSuccess(BODY_WITHOUT_PRIMITIVES, MediaType.APPLICATION_JSON));

        Contact contact = builder.build().get().uri("/contacts/c-1").retrieve().body(Contact.class);

        assertThat(contact).isEqualTo(new Contact("c-1", false, 0));
    }

    @Test
    void shouldLetAWebClientReadAResponseWithMissingAndNullPrimitives() {
        ExchangeStrategies strategies = ExchangeStrategies.builder().codecs(Jackson2Compatibility::webClientCodecs).build();
        WebClient webClient = WebClient.builder()
                .codecs(Jackson2Compatibility::webClientCodecs)
                .exchangeFunction(request -> Mono.just(ClientResponse.create(HttpStatus.OK, strategies)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .body(BODY_WITHOUT_PRIMITIVES)
                        .build()))
                .build();

        Contact contact = webClient.get().uri("/contacts/c-1").retrieve().bodyToMono(Contact.class).block();

        assertThat(contact).isEqualTo(new Contact("c-1", false, 0));
    }
}
