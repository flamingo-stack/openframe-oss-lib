package com.openframe.management.service;

import com.openframe.data.document.client.ClientVersion;
import com.openframe.data.repository.client.ClientVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ClientVersionService {

	private final ClientVersionRepository repository;

	public void upsertClientVersion(String imageTagVersion) {
		ClientVersion current = repository.findTopByOrderByCreatedAtDesc()
				.orElseGet(ClientVersion::new);
		current.setImageTagVersion(imageTagVersion);
		repository.save(current);
	}
}


