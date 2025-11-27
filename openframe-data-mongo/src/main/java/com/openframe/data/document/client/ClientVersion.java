package com.openframe.data.document.client;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "client_version")
public class ClientVersion {

	@Id
	private String id;

	/**
	 * Image tag version string (e.g., "4.2.0", "1.0.0-beta")
	 */
	@Indexed
	private String imageTagVersion;

	/**
	 * Timestamp when this client version was created
	 */
	@CreatedDate
	private Instant createdAt;

	/**
	 * Timestamp when this client version was last updated
	 */
	@LastModifiedDate
	private Instant updatedAt;
}


