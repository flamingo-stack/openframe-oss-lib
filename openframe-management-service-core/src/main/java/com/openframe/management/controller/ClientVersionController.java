package com.openframe.management.controller;

import com.openframe.management.service.ClientVersionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/v1/client-version")
@RequiredArgsConstructor
public class ClientVersionController {

	private final ClientVersionService clientVersionService;

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public void upsertClientVersion(@Valid @RequestBody ClientVersionRequest request) {
		log.info("[client-version] received request: imageTagVersion={}", request.getImageTagVersion());
		clientVersionService.upsertClientVersion(request.getImageTagVersion());
	}

	@Data
	public static class ClientVersionRequest {
		@NotBlank
		private String imageTagVersion;
	}
}


