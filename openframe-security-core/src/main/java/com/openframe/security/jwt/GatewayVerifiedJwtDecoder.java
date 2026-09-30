package com.openframe.security.jwt;

import com.nimbusds.jwt.EncryptedJWT;
import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTParser;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.MappedJwtClaimSetConverter;

import java.text.ParseException;
import java.util.Map;

public class GatewayVerifiedJwtDecoder implements JwtDecoder {

    private final Converter<Map<String, Object>, Map<String, Object>> claimSetConverter =
            MappedJwtClaimSetConverter.withDefaults(Map.of());

    @Override
    public Jwt decode(String token) {
        JWT parsed = parse(token);
        if (parsed instanceof EncryptedJWT) {
            throw new BadJwtException("Encrypted tokens are not supported");
        }
        Map<String, Object> claims = claimSetConverter.convert(claimsOf(parsed));
        return build(token, parsed, claims);
    }

    private static JWT parse(String token) {
        try {
            return JWTParser.parse(token);
        } catch (ParseException e) {
            throw new BadJwtException("Malformed token: " + e.getMessage(), e);
        }
    }

    private static Map<String, Object> claimsOf(JWT parsed) {
        try {
            return parsed.getJWTClaimsSet().getClaims();
        } catch (ParseException e) {
            throw new BadJwtException("Malformed token claims: " + e.getMessage(), e);
        }
    }

    private static Jwt build(String token, JWT parsed, Map<String, Object> claims) {
        try {
            return Jwt.withTokenValue(token)
                    .headers(headers -> headers.putAll(parsed.getHeader().toJSONObject()))
                    .claims(values -> values.putAll(claims))
                    .build();
        } catch (IllegalArgumentException e) {
            throw new BadJwtException("Malformed token claims: " + e.getMessage(), e);
        }
    }
}
