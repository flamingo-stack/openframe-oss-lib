package com.openframe.api.service.packagesearch;

import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.IntStream;

// the Chocolatey community feed is Atom-XML-only (406 on JSON); the package id lives in atom:title,
// NOT in the OData properties
@Component
class ChocoFeedParser {

    private static final String ATOM_NS = "http://www.w3.org/2005/Atom";
    private static final String DATA_NS = "http://schemas.microsoft.com/ado/2007/08/dataservices";

    List<ChocoEntry> parse(String xml) {
        Document document = parseDocument(xml);
        NodeList entryNodes = document.getElementsByTagNameNS(ATOM_NS, "entry");
        int entryCount = entryNodes.getLength();
        return IntStream.range(0, entryCount)
                .mapToObj(entryNodes::item)
                .map(Element.class::cast)
                .map(ChocoFeedParser::toEntry)
                .toList();
    }

    private static Document parseDocument(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            InputSource source = new InputSource(new StringReader(xml));
            return factory.newDocumentBuilder().parse(source);
        } catch (Exception e) {
            throw new IllegalStateException("failed to parse Chocolatey feed", e);
        }
    }

    private static ChocoEntry toEntry(Element entry) {
        String downloadCountText = text(entry, DATA_NS, "DownloadCount");
        String publishedText = text(entry, DATA_NS, "Published");
        String prereleaseText = text(entry, DATA_NS, "IsPrerelease");
        return ChocoEntry.builder()
                .id(text(entry, ATOM_NS, "title"))
                .title(text(entry, DATA_NS, "Title"))
                .summary(text(entry, ATOM_NS, "summary"))
                .description(text(entry, DATA_NS, "Description"))
                .version(text(entry, DATA_NS, "Version"))
                .downloadCount(parseInteger(downloadCountText))
                .iconUrl(text(entry, DATA_NS, "IconUrl"))
                .projectUrl(text(entry, DATA_NS, "ProjectUrl"))
                .tags(text(entry, DATA_NS, "Tags"))
                .published(parseInstant(publishedText))
                .prerelease(parseBoolean(prereleaseText))
                .build();
    }

    private static String text(Element entry, String namespace, String localName) {
        NodeList nodes = entry.getElementsByTagNameNS(namespace, localName);
        if (nodes.getLength() == 0) {
            return null;
        }
        String value = nodes.item(0).getTextContent();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static Integer parseInteger(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Boolean parseBoolean(String value) {
        return value == null ? null : Boolean.parseBoolean(value);
    }

    // OData Edm.DateTime has no zone suffix (2024-03-11T12:00:00); treated as UTC
    private static Instant parseInstant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (Exception ignored) {
            // fall through to the zoneless format
        }
        try {
            LocalDateTime zoneless = LocalDateTime.parse(value);
            return zoneless.toInstant(ZoneOffset.UTC);
        } catch (Exception e) {
            return null;
        }
    }
}
