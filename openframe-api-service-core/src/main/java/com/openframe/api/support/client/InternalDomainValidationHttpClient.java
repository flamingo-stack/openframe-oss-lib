package com.openframe.api.support.client;

import com.openframe.api.support.dto.DomainExistsRequest;
import com.openframe.api.support.dto.DomainExistsResponse;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

@HttpExchange(
        url = "/internal/domains",
        accept = "application/json",
        contentType = "application/json"
)
public interface InternalDomainValidationHttpClient {

    @PostExchange("/exists")
    DomainExistsResponse exists(@RequestBody DomainExistsRequest request);
}


