#!/usr/bin/env python3
"""
coverage_matrix.py — API test-coverage matrix for the OpenFrame stack.

Builds three inventories, all read from git at pinned refs (never from a working tree):

  product   every GraphQL Query/Mutation field in the *.graphqls schemas and every Spring MVC
            endpoint (@RestController / @Controller mappings) in the four product repositories
  frontend  every GraphQL root field the dashboard app (openframe-oss-frontend) selects in its
            Relay documents, and every REST path it sends through apiClient / fetch
  tests     every GraphQL root field and REST path the test library (openframe-test-service-core)
            calls, and which @Test methods reach each of them (directly, via a helper / base
            class, or via another API-client method)

and joins them into one matrix: for each product operation, who uses it (UI) and who tests it.

Usage:
  python3 coverage_matrix.py --root ~/sandbox/flamingo --out results/2026-09-12
  python3 coverage_matrix.py --root ~/sandbox/flamingo --test-ref origin/my-branch --no-history

Python 3.9+, stdlib only. Output: <out>/coverage.json and <out>/coverage.md.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from io import BytesIO

# ----------------------------------------------------------------------------- repositories

PRODUCT_REPOS = ["openframe-oss-lib", "openframe-saas-tenant", "openframe-saas-shared", "openframe-saas-lib"]
FRONTEND_REPO = "openframe-oss-frontend"
TEST_REPO = "openframe-oss-lib"
TEST_MODULE = "openframe-test-service-core"
TEST_SRC = f"{TEST_MODULE}/src/main/java/com/openframe/test"

# Public path prefix -> what the gateway does with it (see configs/base/openframe-saas-gateway.yml
# in openframe-saas-tenant and openframe-saas-shared). A consumer path is matched against product
# endpoints both as written and with its gateway prefix stripped.
GATEWAY_PREFIXES = {
    "api": "tenant gateway /api/** -> openframe-saas-api (StripPrefix=1); shared gateway /api/** -> shared saas-api",
    "chat": "tenant gateway /chat/** -> openframe-saas-ai-agent (StripPrefix=1)",
    "clients": "tenant gateway /clients/** -> openframe-saas-client (StripPrefix=1)",
    "external-api": "tenant gateway /external-api/** -> openframe-saas-external-api (StripPrefix=1)",
    "sas": "shared gateway /sas/** -> openframe-saas-auth-server (context path /sas)",
    "tools": "tenant gateway /tools/** -> gateway IntegrationController proxy to integrated tools",
    "oauth": "served by the gateway itself (OAuth BFF, openframe-security-oauth)",
}

HTTP_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")


def git(repo, *args, check=True, text=True):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=text)
    if r.returncode != 0:
        if check:
            raise RuntimeError(f"git {' '.join(args)} in {repo} failed: {r.stderr.strip()[:300] if text else r.stderr[:300]}")
        return "" if text else b""
    return r.stdout


def resolve_ref(repo, ref):
    return git(repo, "rev-parse", ref).strip()


def ls_tree(repo, ref, path=""):
    args = ["ls-tree", "-r", "--name-only", ref]
    if path:
        args += ["--", path]
    return git(repo, *args).splitlines()


def show(repo, ref, path):
    return git(repo, "show", f"{ref}:{path}", check=False)


def archive_to_dir(repo, ref, path, dest):
    """Extract <path> at <ref> into <dest> (fast bulk read, still never the working tree)."""
    data = git(repo, "archive", "--format=tar", ref, "--", path, text=False)
    with tarfile.open(fileobj=BytesIO(data)) as tf:
        try:
            tf.extractall(dest, filter="data")
        except TypeError:  # Python < 3.12
            tf.extractall(dest)
    return os.path.join(dest, path)


def read_tree(root):
    out = {}
    for dp, _, fns in os.walk(root):
        for fn in fns:
            p = os.path.join(dp, fn)
            with open(p, encoding="utf-8", errors="replace") as f:
                out[os.path.relpath(p, root)] = f.read()
    return out


def ere_escape(s):
    """Escape for git's --extended-regexp (POSIX ERE): re.escape() emits sequences ERE does not know."""
    return re.sub(r"([.^$*+?()\[\]{}|\\/])", r"\\\1", s)


def first_commit_date(repo, ref, path, regex=None):
    """Date of the oldest commit on <ref> touching <path>; with <regex>, the oldest commit whose diff
    added or removed a line matching it (POSIX ERE — no \\s, use [[:space:]])."""
    args = ["log", "--format=%ad", "--date=short", "--follow"]
    if regex:
        args = ["log", "--format=%ad", "--date=short", "--extended-regexp", "-G" + regex]
    out = git(repo, *args, ref, "--", path, check=False).split()
    return out[-1] if out else None


# ----------------------------------------------------------------------------- GraphQL parsing

_GQL_PUNCT = set("{}():[]!=@$&|")


def gql_strip(doc):
    doc = re.sub(r'"""[\s\S]*?"""', '""', doc)
    doc = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', doc)
    doc = re.sub(r"#[^\n]*", "", doc)
    return doc


def gql_tokens(doc):
    doc = gql_strip(doc)
    toks = []
    i, n = 0, len(doc)
    while i < n:
        c = doc[i]
        if c.isspace() or c == ",":
            i += 1
        elif doc.startswith("...", i):
            toks.append("...")
            i += 3
        elif c in _GQL_PUNCT:
            toks.append(c)
            i += 1
        elif c == '"':
            toks.append('""')
            i += 2
        else:
            m = re.match(r"[A-Za-z_][A-Za-z0-9_]*|-?[0-9][0-9.eE+-]*|%[a-z]|\S", doc[i:])
            toks.append(m.group(0))
            i += len(m.group(0))
    return toks


class GqlParser:
    """Recursive-descent parser for the subset needed: operations, fragments, selection sets."""

    def __init__(self, doc):
        self.t = gql_tokens(doc)
        self.i = 0

    def peek(self, k=0):
        j = self.i + k
        return self.t[j] if j < len(self.t) else None

    def take(self):
        tok = self.peek()
        self.i += 1
        return tok

    def skip_balanced(self, open_, close):
        depth = 0
        while self.i < len(self.t):
            tok = self.take()
            if tok == open_:
                depth += 1
            elif tok == close:
                depth -= 1
                if depth == 0:
                    return

    def skip_directives(self):
        while self.peek() == "@":
            self.take()
            self.take()
            if self.peek() == "(":
                self.skip_balanced("(", ")")

    def selection_set(self):
        """Returns (fields, spreads) at this level; nested sets are parsed and discarded."""
        fields, spreads = [], []
        assert self.take() == "{"
        while self.peek() not in ("}", None):
            tok = self.take()
            if tok == "...":
                if self.peek() == "on":
                    self.take()
                    self.take()
                    self.skip_directives()
                    f, s = self.selection_set()
                    fields += f
                    spreads += s
                elif self.peek() == "{":
                    f, s = self.selection_set()
                    fields += f
                    spreads += s
                elif self.peek() == "@":
                    self.skip_directives()
                    f, s = self.selection_set()
                    fields += f
                    spreads += s
                else:
                    spreads.append(self.take())
                    self.skip_directives()
                continue
            name = tok
            if self.peek() == ":":  # alias
                self.take()
                name = self.take()
            if self.peek() == "(":
                self.skip_balanced("(", ")")
            self.skip_directives()
            if self.peek() == "{":
                self.selection_set()
            fields.append(name)
        self.take()  # }
        return fields, spreads

    def document(self):
        ops, frags = [], {}
        while self.i < len(self.t):
            tok = self.peek()
            if tok in ("query", "mutation", "subscription"):
                self.take()
                name = None
                if self.peek() not in ("(", "{", "@"):
                    name = self.take()
                if self.peek() == "(":
                    self.skip_balanced("(", ")")
                self.skip_directives()
                if self.peek() != "{":
                    continue
                fields, spreads = self.selection_set()
                ops.append({"kind": tok, "name": name, "fields": fields, "spreads": spreads})
            elif tok == "fragment":
                self.take()
                name = self.take()
                if self.peek() == "on":
                    self.take()
                    on = self.take()
                else:
                    on = None
                self.skip_directives()
                if self.peek() != "{":
                    continue
                fields, spreads = self.selection_set()
                frags[name] = {"on": on, "fields": fields, "spreads": spreads}
            elif tok == "{":
                fields, spreads = self.selection_set()
                ops.append({"kind": "query", "name": None, "fields": fields, "spreads": spreads})
            else:
                self.take()
        return ops, frags


def parse_gql_documents(doc):
    try:
        return GqlParser(doc).document()
    except (AssertionError, IndexError, TypeError):
        return [], {}


GQL_SCALARS = {"String", "Int", "Float", "Boolean", "ID", "Instant", "Long", "JSON", "DateTime", "Date",
               "BigDecimal", "Upload", "Object", "Any", "UUID", "LocalDate", "LocalDateTime", "Map"}


def schema_root_field_defs(schema_text):
    """{kind: {name: {"args": "<args as written>", "returns": "<type>", "types": [named types]}}}
    for the root types of a .graphqls / schema.graphql text."""
    s = gql_strip(schema_text)
    out = {"query": {}, "mutation": {}, "subscription": {}}
    for m in re.finditer(r"(?:extend\s+)?type\s+(Query|Mutation|Subscription)\b[^{]*\{", s):
        start = m.end()
        depth, i = 1, start
        while i < len(s) and depth:
            depth += (s[i] == "{") - (s[i] == "}")
            i += 1
        body = s[start:i - 1]
        body = re.sub(r"\(([^)]*)\)", lambda mm: "(" + " ".join(mm.group(1).split()) + ")", body, flags=re.S)
        for line in body.splitlines():
            mm = re.match(r"\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*:\s*([\[\]A-Za-z0-9_!]+)", line)
            if mm:
                args, returns = mm.group(2) or "", mm.group(3)
                types = sorted({t for t in re.findall(r"\b([A-Z][A-Za-z0-9_]*)\b", args + " " + returns)
                                if t not in GQL_SCALARS})
                out[m.group(1).lower()][mm.group(1)] = {"args": args, "returns": returns, "types": types}
    return out


def schema_root_fields(schema_text):
    """{ 'query': [names], 'mutation': [...] } — names only."""
    return {k: list(v) for k, v in schema_root_field_defs(schema_text).items()}


# ----------------------------------------------------------------------------- Java helpers

def java_strip_comments(src):
    src = re.sub(r"/\*[\s\S]*?\*/", "", src)
    src = re.sub(r"(?m)^\s*//[^\n]*$", "", src)
    src = re.sub(r"(?<!:)//[^\n\"]*$", "", src, flags=re.M)
    return src


def java_find_block_end(src, open_idx):
    """Index just past the '}' matching the '{' at open_idx, skipping strings and text blocks."""
    depth, i, n = 0, open_idx, len(src)
    while i < n:
        c = src[i]
        if src.startswith('"""', i):
            j = src.find('"""', i + 3)
            i = (j + 3) if j >= 0 else n
            continue
        if c == '"':
            i += 1
            while i < n and src[i] != '"':
                i += 2 if src[i] == "\\" else 1
            i += 1
            continue
        if c == "'":
            i += 1
            while i < n and src[i] != "'":
                i += 2 if src[i] == "\\" else 1
            i += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


JAVA_METHOD_RE = re.compile(
    r"(?m)^[ \t]*(?:(?:public|private|protected|static|final|synchronized|default)\s+)*"
    r"(?:<[^>]+>\s+)?([\w.?]+(?:<[^(){};]*>)?(?:\[\])*)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w., ]+)?\s*\{")
JAVA_NOT_A_METHOD = {"if", "for", "while", "switch", "catch", "synchronized", "else", "return", "new", "throw",
                     "class", "record", "interface", "enum"}


def java_methods(src):
    """[{name, start, body_start, end, body, head}] for every method with a body.

    `head` is the annotation block that belongs to the method: the text after the previous
    declaration boundary (';', '{' or '}') up to the signature — so class-level annotations are
    never attributed to the first method. JUnit 5 test methods may be package-private, so the
    access modifier is optional."""
    out = []
    prev_end = 0
    for m in JAVA_METHOD_RE.finditer(src):
        if m.start() < prev_end:
            continue  # signature-like text inside a previous method body (lambdas, anonymous classes)
        typ, name = m.group(1), m.group(2)
        if name in JAVA_NOT_A_METHOD or typ in JAVA_NOT_A_METHOD:
            continue
        open_idx = m.end() - 1
        end = java_find_block_end(src, open_idx)
        head = src[prev_end:m.start()]
        blanked = re.sub(r'"(?:[^"\\]|\\.)*"', lambda s: '"' + " " * (len(s.group(0)) - 2) + '"', head)
        cut = max(blanked.rfind(";"), blanked.rfind("{"), blanked.rfind("}"))  # boundaries outside strings
        head = head[cut + 1:]
        out.append({"name": name, "start": m.start(), "body_start": open_idx, "end": end,
                    "body": src[open_idx:end], "head": head})
        prev_end = end
    return out


def java_string_literals(expr):
    return re.findall(r'"((?:[^"\\]|\\.)*)"', expr)


def java_class_name(src):
    m = re.search(r"\b(?:class|interface|enum|record)\s+(\w+)", src)
    return m.group(1) if m else None


# ----------------------------------------------------------------------------- path normalisation

def norm_path(p):
    p = p.strip()
    p = re.sub(r"\?.*$", "", p)              # query string
    p = re.sub(r"\$\{[^}]*\}", "{}", p)       # JS template expressions
    p = re.sub(r"\{[^}/]*\}", "{}", p)        # {id}, {id:regex}
    p = re.sub(r"%[sd]", "{}", p)             # String.format placeholders
    p = re.sub(r"/{2,}", "/", p)
    p = p.strip("/")
    return p


def path_candidates(p):
    """The path as written plus its gateway-stripped form, for matching against service paths."""
    p = norm_path(p)
    cands = [p]
    head = p.split("/", 1)
    if head[0] in GATEWAY_PREFIXES and len(head) > 1:
        cands.append(head[1])
    return cands


def paths_match(consumer_norm, product_norm):
    a, b = consumer_norm.split("/"), product_norm.split("/")
    if "**" in b:
        b = b[:b.index("**")]
        if len(a) < len(b):
            return False
        a = a[:len(b)]
    elif len(a) != len(b):
        return False
    return all(x == y or x == "{}" or y == "{}" or y == "*" for x, y in zip(a, b))


GRAPHQL_TRANSPORT = re.compile(r"(^|/)graphql$")


# ----------------------------------------------------------------------------- product inventory

def module_of(path):
    if "/src/" in path:
        return path.split("/src/")[0]
    return path.split("/")[0]


def product_graphql(root, refs, with_history):
    ops = {}
    for repo in ["openframe-oss-lib", "openframe-saas-tenant", "openframe-saas-lib", "openframe-saas-shared"]:
        rp = os.path.join(root, repo)
        if not os.path.isdir(os.path.join(rp, ".git")):
            continue
        ref = refs[repo]
        files = [f for f in ls_tree(rp, ref) if f.endswith((".graphqls", ".graphql"))
                 and "/src/main/" in f and "/src/test/" not in f]
        for f in files:
            defs = schema_root_field_defs(show(rp, ref, f))
            for kind in ("query", "mutation", "subscription"):
                for name, d in defs[kind].items():
                    key = f"{kind}:{name}"
                    rec = ops.setdefault(key, {"kind": kind, "name": name, "sources": [], "introduced": None, "types": []})
                    rec["types"] = sorted(set(rec["types"]) | set(d["types"]))
                    src = {"repo": repo, "module": module_of(f), "file": f, "args": d["args"], "returns": d["returns"]}
                    if with_history:
                        src["introduced"] = first_commit_date(rp, ref, f, regex=rf"^[[:space:]]*{ere_escape(name)}[[:space:]]*[(:]")
                        if src["introduced"] and (rec["introduced"] is None or src["introduced"] < rec["introduced"]):
                            rec["introduced"] = src["introduced"]
                    rec["sources"].append(src)
    return ops


MAPPING_START_RE = re.compile(r"@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\b")


def find_mappings(body):
    """Yield (kind, args_text, end_index) for every mapping annotation, with balanced parentheses."""
    for m in MAPPING_START_RE.finditer(body):
        kind, i = m.group(1), m.end()
        while i < len(body) and body[i].isspace():
            i += 1
        if i < len(body) and body[i] == "(":
            depth, j = 0, i
            while j < len(body):
                c = body[j]
                if c == '"':
                    j += 1
                    while j < len(body) and body[j] != '"':
                        j += 2 if body[j] == "\\" else 1
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            yield kind, body[i + 1:j], j + 1
        else:
            yield kind, "", m.end()


def annotation_paths(arg_text):
    if not arg_text:
        return [""]
    m = re.search(r"\b(?:value|path)\s*=\s*(\{[^}]*\}|\"(?:[^\"\\]|\\.)*\")", arg_text)
    if m:
        return java_string_literals(m.group(1)) or [""]
    if re.match(r"\s*(\"|\{)", arg_text):
        return java_string_literals(arg_text) or [""]
    return [""]


def annotation_methods(kind, arg_text):
    if kind != "RequestMapping":
        return [kind.replace("Mapping", "").upper()]
    ms = re.findall(r"RequestMethod\.(\w+)", arg_text or "")
    return ms or ["ANY"]


def product_rest(root, refs, with_history):
    endpoints = []
    for repo in PRODUCT_REPOS:
        rp = os.path.join(root, repo)
        if not os.path.isdir(os.path.join(rp, ".git")):
            continue
        ref = refs[repo]
        files = git(rp, "grep", "-l", "-e", "@RestController", "-e", "@Controller", ref, "--", "*.java", check=False).splitlines()
        files = [f.split(":", 1)[1] for f in files if ":" in f and "/src/main/" in f]
        for f in files:
            src = java_strip_comments(show(rp, ref, f))
            if not re.search(r"@(RestController|Controller)(?![\w])", src):
                continue
            cls = java_class_name(src) or os.path.basename(f)
            cls_idx = re.search(r"\b(class|interface)\s+" + re.escape(cls), src)
            head = src[:cls_idx.start()] if cls_idx else ""
            class_paths = [""]
            for kind, args, _ in find_mappings(head):
                if kind == "RequestMapping":
                    class_paths = annotation_paths(args)
                    break
            body = src[cls_idx.start():] if cls_idx else src
            view_only = "@RestController" not in src and "@ResponseBody" not in src
            for kind, args, end in find_mappings(body):
                after = body[end:end + 600]
                hm = re.search(r"[\w<>\[\],.?]+\s+(\w+)\s*\(", after)
                handler = hm.group(1) if hm else "?"
                for mp in annotation_paths(args):
                    for cp in class_paths:
                        full = norm_path(cp + "/" + mp)
                        for method in annotation_methods(kind, args):
                            rec = {"method": method, "path": full, "repo": repo, "module": module_of(f),
                                   "class": cls, "handler": handler, "file": f, "view": view_only}
                            if with_history:
                                rx = ere_escape('"' + mp.strip() + '"') if norm_path(mp) else None
                                rec["introduced"] = first_commit_date(rp, ref, f, regex=rx) if rx else first_commit_date(rp, ref, f)
                            endpoints.append(rec)
    return endpoints


# ----------------------------------------------------------------------------- frontend inventory

def fe_feature(path):
    parts = path.split("/")
    if parts and parts[0] == "src":
        parts = parts[1:]
    if not parts:
        return "root"
    if parts[0] == "app":
        for seg in parts[1:]:
            if not (seg.startswith("(") and seg.endswith(")")) and "." not in seg:
                return seg
        return "app-root"
    if parts[0] in ("components", "graphql", "stores", "lib", "hooks") and len(parts) > 2:
        return parts[1]
    return parts[0]


def frontend_inventory(root, ref):
    rp = os.path.join(root, FRONTEND_REPO)
    if not os.path.isdir(os.path.join(rp, ".git")):
        return None
    tmp = tempfile.mkdtemp(prefix="fe-")
    try:
        src_dir = archive_to_dir(rp, ref, "src", tmp)
        files = read_tree(src_dir)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    schema_text = show(rp, ref, "schema.graphql")
    schema = schema_root_fields(schema_text) if schema_text else {"query": [], "mutation": [], "subscription": []}

    gql_usage = defaultdict(list)     # "query:devices" -> [{op, file, feature}]
    frags = {}
    op_count = 0
    consts = {}
    for path, text in files.items():
        if not path.endswith((".ts", ".tsx")):
            continue
        if any(x in path for x in ("__generated__", "__mocks__", "__tests__", ".test.", ".stories.", "/stories/")):
            continue
        # Three document forms: Relay tagged templates (graphql`…`); untagged template literals that
        # open with the `#graphql` marker; and plain template literals whose content starts with an
        # operation keyword (`query GetTickets(` on the next line) — raw documents posted through
        # apiClient. `/api/graphql` inside a URL template is not a document: the tag must not be
        # preceded by a path character. `${…}` splices are blanked before parsing.
        doc_re = (r"(?:(?<![\w/.'\"-])graphql\s*`|`\s*#graphql\b|"
                  r"(?:[=(,:?]|=>|\breturn)\s*`(?=\s*(?:(?:query|mutation|subscription)\s*(?:[A-Za-z_]\w*\s*)?[({]|fragment\s+[A-Za-z_]\w*\s+on\b)))"
                  r"([\s\S]*?)`")
        for m in re.finditer(doc_re, text):
            ops, fr = parse_gql_documents(re.sub(r"\$\{[^}]*\}", " ", m.group(1)))
            if any(not re.fullmatch(r"[A-Za-z_]\w*", f) for op in ops for f in op["fields"]):
                continue  # English prose or code between backticks, not a document
            for name, f in fr.items():
                frags[name] = dict(f, file=path)
            for op in ops:
                op_count += 1
                for field in op["fields"]:
                    gql_usage[f"{op['kind']}:{field}"].append(
                        {"op": op["name"] or "(anonymous)", "file": "src/" + path, "feature": fe_feature("src/" + path)})
                for spread in op["spreads"]:
                    gql_usage.setdefault(f"spread:{spread}", []).append(
                        {"op": op["name"] or "(anonymous)", "file": "src/" + path, "feature": fe_feature("src/" + path)})
        if "API_ENDPOINTS" in text:
            m = re.search(r"export\s+const\s+API_ENDPOINTS\s*=\s*\{([^}]*)\}", text)
            if m:
                for k, v in re.findall(r"(\w+)\s*:\s*['\"`]([^'\"`]+)['\"`]", m.group(1)):
                    consts[k] = v
    # fragments on the root types are root selections too (Relay @refetchable pagination fragments)
    for name, f in frags.items():
        if f.get("on") in ("Query", "Mutation"):
            kind = f["on"].lower()
            for field in f["fields"]:
                gql_usage[f"{kind}:{field}"].append(
                    {"op": f"fragment {name}", "file": "src/" + f["file"], "feature": fe_feature("src/" + f["file"])})
    # resolve spreads at operation root level to the fragment's fields
    for key in [k for k in list(gql_usage) if k.startswith("spread:")]:
        frag = frags.get(key[len("spread:"):])
        uses = gql_usage.pop(key)
        if frag and frag.get("on") in ("Query", "Mutation"):
            kind = frag["on"].lower()
            for field in frag["fields"]:
                for u in uses:
                    gql_usage[f"{kind}:{field}"].append(u)

    rest_usage = defaultdict(list)    # "GET api/users" -> [{file, feature, raw}]
    call_re = re.compile(r"\b(apiClient|fetch|embedAuthedFetch|contentFetch)\s*\.?\s*(get|post|put|patch|delete|request)?\s*(?:<[^>]*>)?\(\s*([`'\"])([^`'\"]*)\3")
    for path, text in files.items():
        if not path.endswith((".ts", ".tsx")):
            continue
        if any(x in path for x in ("__generated__", "__mocks__", "__tests__", ".test.", ".stories.", "/stories/")):
            continue
        for m in call_re.finditer(text):
            fn, method, _, raw = m.group(1), m.group(2), m.group(3), m.group(4)
            if fn == "fetch" and method:
                continue
            if raw.startswith("http"):
                continue
            resolved = re.sub(r"\$\{API_ENDPOINTS\.(\w+)\}", lambda mm: consts.get(mm.group(1), mm.group(0)), raw)
            if method is None:
                # fetch(url, {method: 'X'}) — look ahead in the same call
                tail = text[m.end():m.end() + 400]
                mm = re.search(r"method\s*:\s*['\"](\w+)['\"]", tail)
                method = (mm.group(1) if mm else "GET").lower()
            if GRAPHQL_TRANSPORT.search(norm_path(resolved)):
                continue  # GraphQL transport, accounted for by the document scan
            key = f"{method.upper()} {norm_path(resolved)}"
            rest_usage[key].append({"file": "src/" + path, "feature": fe_feature("src/" + path), "raw": raw})
    return {
        "ref": ref, "schema_roots": schema, "op_documents": op_count,
        "graphql": dict(gql_usage), "rest": dict(rest_usage),
    }


# ----------------------------------------------------------------------------- test-library inventory

def resolve_java_constants(src):
    consts = {}
    for m in re.finditer(r"static\s+final\s+String\s+(\w+)\s*=\s*([^;]+);", src):
        consts[m.group(1)] = m.group(2).strip()
    resolved = {}

    def fold(expr, depth=0):
        if depth > 8:
            return None
        expr = expr.strip()
        parts = []
        for tok in re.findall(r'"(?:[^"\\]|\\.)*"|[A-Za-z_][\w.]*(?:\([^)]*\))?', expr):
            if tok.startswith('"'):
                parts.append(tok[1:-1])
            elif tok.endswith(")"):
                parts.append("{}")
            else:
                name = tok.split(".")[-1]
                if name in resolved:
                    parts.append(resolved[name])
                elif name in consts:
                    v = fold(consts[name], depth + 1)
                    if v is None:
                        return None
                    parts.append(v)
                else:
                    return None
        return "".join(parts) if parts else None

    for k in consts:
        v = fold(consts[k])
        if v is not None:
            resolved[k] = v
    return resolved


def resolve_path_expr(expr, consts):
    """'USERS.concat("/").concat(userId)' / 'BASE + "/x"' / '"api/x"' / 'String.format(X, id)' -> path or None."""
    expr = expr.strip()
    m = re.match(r"String\.format\(\s*([^,]+),", expr)
    if m:
        expr = m.group(1)
    out = ""
    for tok in re.findall(r'"(?:[^"\\]|\\.)*"|\.concat\(([^()]*(?:\([^()]*\))?[^()]*)\)|[A-Za-z_][\w.]*|\+', expr):
        pass
    # token walk with concat support
    i, n = 0, len(expr)
    while i < n:
        c = expr[i]
        if c == '"':
            j = i + 1
            while j < n and expr[j] != '"':
                j += 2 if expr[j] == "\\" else 1
            out += expr[i + 1:j]
            i = j + 1
        elif expr.startswith(".concat(", i):
            j = expr.find(")", i)
            inner = expr[i + 8:j]
            lit = java_string_literals(inner)
            out += lit[0] if lit else "{}"
            i = j + 1
        elif c.isalpha() or c == "_":
            m = re.match(r"[A-Za-z_][\w.]*", expr[i:])
            name = m.group(0).split(".")[-1]
            if name in consts:
                out += consts[name]
            elif m.group(0) in ("GRAPHQL", "CHAT_GRAPHQL", "EnvironmentConfig.GRAPHQL", "EnvironmentConfig.CHAT_GRAPHQL"):
                out += {"GRAPHQL": "api/graphql", "CHAT_GRAPHQL": "chat/graphql"}[name]
            else:
                out += "{}"
            i += len(m.group(0))
        else:
            i += 1
    out = re.sub(r"^\{\}(?=[A-Za-z])", "", out)  # leading base-URL variable ("registrationUrl + \"sas/...\"")
    return out if out and out != "{}" else None


def test_inventory(root, ref):
    rp = os.path.join(root, TEST_REPO)
    tmp = tempfile.mkdtemp(prefix="tests-")
    try:
        src_dir = archive_to_dir(rp, ref, TEST_SRC, tmp)
        files = read_tree(src_dir)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    files = {p: java_strip_comments(t) for p, t in files.items() if p.endswith(".java")}

    # 1. GraphQL documents: constants in api/graphql/*.java text blocks
    gql_consts = {}   # "QueriesClass.CONST" -> {class, name, fields}; two classes may reuse a constant name
    for path, text in files.items():
        if not path.startswith("api/graphql/"):
            continue
        cls = java_class_name(text)
        for m in re.finditer(r"static\s+final\s+String\s+(\w+)\s*=\s*\"\"\"([\s\S]*?)\"\"\"", text):
            ops, frags = parse_gql_documents(m.group(2))
            fields = []
            for op in ops:
                fields += [f"{op['kind']}:{f}" for f in op["fields"]]
                for sp in op["spreads"]:
                    fr = frags.get(sp)
                    if fr:
                        kind = (fr.get("on") or "Query").lower()
                        fields += [f"{kind}:{f}" for f in fr["fields"]]
            gql_consts[f"{cls}.{m.group(1)}"] = {"class": cls, "name": m.group(1), "fields": sorted(set(fields))}

    # 2. API client methods -> operations (GraphQL fields and REST method+path)
    client_methods = {}   # "TicketApi.getTickets" -> {"gql": set, "rest": set, "calls": set}
    client_classes = set()
    class_method_names = defaultdict(set)
    for path, text in files.items():
        if path.startswith("api/") and not path.startswith("api/graphql/"):
            cls = java_class_name(text)
            if cls:
                client_classes.add(cls)
                class_method_names[cls] = {m["name"] for m in java_methods(text)}

    def client_calls(text, self_cls=None):
        """'Client.method' for every call into a class under api/.

        Static calls `Client.method(` and method references `Client::method` resolve exactly. Instance
        calls `.method(` (fluent chains such as
        `new AuthFlowSAAS(user).discoverTenant().startFlow()`) resolve against the client classes
        referenced in the same text (plus the enclosing class), so a method name is credited to every
        referenced class that defines it."""
        out = {f"{c}.{mth}" for c, mth in re.findall(r"\b([A-Z]\w*)\.(\w+)\(", text) if c in client_classes}
        # method references (`AiSettingsApi::updateAdminAiConfig`) are calls too
        out |= {f"{c}.{mth}" for c, mth in re.findall(r"\b([A-Z]\w*)::(\w+)\b", text) if c in client_classes}
        referenced = {c for c in client_classes if re.search(rf"\b{c}\b", text)}
        if self_cls:
            referenced.add(self_cls)
        if referenced:
            for name in set(re.findall(r"(?<![\w])\.?(\w+)\(", text)):
                for c in referenced:
                    if name in class_method_names[c]:
                        out.add(f"{c}.{name}")
        return out

    for path, text in files.items():
        if not path.startswith("api/") or path.startswith("api/graphql/"):
            continue
        cls = java_class_name(text)
        if not cls:
            continue
        consts = resolve_java_constants(text)
        # CONST -> QueriesClass for `import static ...graphql.XQueries.CONST;`, and the classes star-imported
        static_imports = {n: c for c, n in re.findall(r"import\s+static\s+com\.openframe\.test\.api\.graphql\.(\w+)\.(\w+);", text)}
        star_imports = set(re.findall(r"import\s+static\s+com\.openframe\.test\.api\.graphql\.(\w+)\.\*;", text))
        external = "getExternalApiSpec" in text or "external" in path
        methods = java_methods(text)
        names = {m["name"] for m in methods}
        for m in methods:
            key = f"{cls}.{m['name']}"
            rec = client_methods.setdefault(key, {"gql": set(), "rest": set(), "calls": set(), "class": cls, "file": path})
            body = m["body"]
            for key, info in gql_consts.items():
                qcls, name = info["class"], info["name"]
                qualified = re.search(rf"\b{qcls}\.{name}\b", body)
                imported = static_imports.get(name) == qcls or qcls in star_imports
                if qualified or (imported and re.search(rf"\b{name}\b", body)):
                    rec["gql"].update(info["fields"])
            body_ext = external or "getExternalApiSpec" in body
            # method-local path variables (`final String UPDATE = ORGANIZATIONS.concat("/").concat(id);`)
            local_consts = dict(consts)
            for lm in re.finditer(r"\bString\s+([A-Za-z_]\w*)\s*=\s*([^;]+);", body):
                folded = resolve_path_expr(lm.group(2), local_consts)
                if folded:
                    local_consts[lm.group(1)] = folded
            for cm in re.finditer(r"\.(get|post|put|patch|delete|head|options)\(\s*([^;]*?)\)\s*(?:[;.)]|$)", body):
                stmt_start = body.rfind(";", 0, cm.start()) + 1
                stmt = body[stmt_start:cm.start()]
                if "given(" not in stmt and "spec" not in stmt.lower() and "Spec" not in stmt:
                    continue
                p = resolve_path_expr(cm.group(2), local_consts)
                if not p or "/" not in p:
                    continue
                if p.startswith("http") or GRAPHQL_TRANSPORT.search(norm_path(p)):
                    continue
                if body_ext and not p.startswith("external-api/"):
                    p = "external-api/" + p
                rec["rest"].add(f"{cm.group(1).upper()} {norm_path(p)}")
            rec["calls"] |= client_calls(body, self_cls=cls)
            rec["calls"].discard(key)
    # transitive closure over client-to-client calls
    changed = True
    while changed:
        changed = False
        for key, rec in client_methods.items():
            for callee in list(rec["calls"]):
                other = client_methods.get(callee)
                if not other:
                    continue
                before = (len(rec["gql"]), len(rec["rest"]))
                rec["gql"] |= other["gql"]
                rec["rest"] |= other["rest"]
                if (len(rec["gql"]), len(rec["rest"])) != before:
                    changed = True

    # 3. helper classes (everything outside api/ and tests/): the API-client calls each makes and the
    #    other helpers it references, so a test is credited with what its helpers reach transitively
    helper_text, helper_calls, helper_refs = {}, {}, {}
    for path, text in files.items():
        if path.startswith("api/") or path.startswith("tests/"):
            continue
        cls = java_class_name(text)
        if cls:
            helper_text[cls] = text
    for cls, text in helper_text.items():
        helper_calls[cls] = client_calls(text)
        helper_refs[cls] = {h for h in helper_text if h != cls and re.search(rf"\b{h}\b", text)}

    def helper_closure(texts):
        seen, todo = set(), set()
        for text in texts:
            todo |= {h for h in helper_text if re.search(rf"\b{h}\b", text)}
        while todo:
            h = todo.pop()
            if h in seen:
                continue
            seen.add(h)
            todo |= helper_refs.get(h, set()) - seen
        return {h for h in seen if helper_calls.get(h)}

    # 4. tests
    tests = []
    class_info = {}
    for path, text in files.items():
        if not path.startswith("tests/"):
            continue
        cls = java_class_name(text)
        if not cls:
            continue
        cm = re.search(r"\bclass\s+" + re.escape(cls), text)
        head = text[:cm.start()] if cm else ""
        class_tags = re.findall(r'@Tag\("([^"]+)"\)', head)
        class_disabled = bool(re.search(r"@Disabled\b", head))
        parent = re.search(r"\bclass\s+\w+\s+extends\s+(\w+)", text)
        class_info[cls] = {"path": path, "tags": class_tags, "parent": parent.group(1) if parent else None,
                           "abstract": bool(re.search(r"\babstract\s+class\b", text)), "disabled": class_disabled}
        methods = java_methods(text)
        setup_calls, setup_assumes = set(), False
        for m in methods:
            if re.search(r"@(BeforeAll|BeforeEach|AfterAll|AfterEach)\b", m["head"]):
                setup_calls |= client_calls(m["body"])
                setup_assumes = setup_assumes or bool(re.search(r"\bassume(True|False|That|ingThat)\b", m["body"]))
        helpers_used = helper_closure([text])
        for m in methods:
            if not re.search(r"@Test\b", m["head"]):
                continue
            dn = re.search(r'@DisplayName\("((?:[^"\\]|\\.)*)"\)', m["head"])
            tags = class_tags + re.findall(r'@Tag\("([^"]+)"\)', m["head"])
            direct = client_calls(m["body"])
            tests.append({
                "class": cls, "method": m["name"], "display": dn.group(1) if dn else m["name"],
                "tags": sorted(set(tags)), "disabled": class_disabled or bool(re.search(r"@Disabled\b", m["head"])),
                "assumes": setup_assumes or bool(re.search(r"\bassume(True|False|That|ingThat)\b", m["body"])),
                "direct": sorted(direct), "setup": sorted(setup_calls), "helpers": sorted(helpers_used),
                "file": path,
            })
    # base-class calls (setup in abstract parents) -> attribute to subclasses
    base_calls = {cls: client_calls(files[info["path"]]) for cls, info in class_info.items()}
    for t in tests:
        chain, seen = [], set()
        p = class_info.get(t["class"], {}).get("parent")
        while p and p in class_info and p not in seen:
            seen.add(p)
            chain.append(p)
            p = class_info[p].get("parent")
        t["base"] = sorted(set().union(*(base_calls.get(c, set()) for c in chain)) if chain else set())
        if chain:  # helpers referenced by the base classes count for the subclass's tests too
            t["helpers"] = sorted(set(t["helpers"]) | helper_closure([files[class_info[c]["path"]] for c in chain]))

    return {
        "ref": ref, "gql_constants": gql_consts, "client_methods": {
            k: {"gql": sorted(v["gql"]), "rest": sorted(v["rest"]), "calls": sorted(v["calls"]), "class": v["class"]}
            for k, v in client_methods.items()},
        "helper_calls": {k: sorted(v) for k, v in helper_calls.items() if v},
        "tests": tests, "classes": class_info,
        # fixture inventories used by the plan's effort model
        "dto_classes": sorted({java_class_name(t) for p, t in files.items() if p.startswith("data/")} - {None}),
        "test_classes": sorted({java_class_name(t) for p, t in files.items() if p.startswith("tests/")} - {None}),
        "client_classes": sorted(client_classes),
    }


# ----------------------------------------------------------------------------- known gaps

KG_HEAD_RE = re.compile(r"^## (KG-\d+) — (.*?) — ([A-Z-]+(?:\([^)]*\))?)", re.M)


def parse_known_gaps(path):
    """[{id, title, class, tokens}] from known-gaps.md. Selectors are the backticked strings of the
    entry's `- **Ops:**` bullet only; the rest of the entry is prose and never selects rows."""
    if not path or not os.path.exists(path):
        return []
    text = open(path, encoding="utf-8").read()
    heads = list(KG_HEAD_RE.finditer(text))
    out = []
    for i, h in enumerate(heads):
        body = text[h.end():heads[i + 1].start() if i + 1 < len(heads) else len(text)]
        m = re.search(r"- \*\*Ops:\*\*(.*?)(?=\n- \*\*|\n## |\Z)", body, re.S)
        ops_text = m.group(1) if m else ""
        out.append({"id": h.group(1), "title": h.group(2).strip(), "class": h.group(3).strip(),
                    "tokens": sorted({t.strip() for t in re.findall(r"`([^`]+)`", ops_text)})})
    return out


def _expand_braces(path):
    m = re.search(r"\{([^{}]*,[^{}]*)\}", path)
    if not m:
        return [path]
    out = []
    for alt in m.group(1).split(","):
        out += _expand_braces(path[:m.start()] + alt.strip() + path[m.end():])
    return out


def kg_matches(row, kg, unique_names):
    """Does a known-gaps entry select this row? Only explicit selectors count, so a module or schema
    file mentioned as context never sweeps in a whole area: an exact key (`query:node`), a bare
    operation name that is unique in the product (`installSoftware`), a controller class name
    (`ImageController`), or a path pattern — `METHOD /path`, `GET|POST /path`, or a bare `/path` for
    any method — with `{a,b}` alternatives, `{id}` variables and `**` suffixes."""
    src = row["sources"][0]
    for tok in kg["tokens"]:
        if tok == row["key"]:
            return True
        if row["surface"] == "graphql":
            if tok == row["name"] and row["name"] in unique_names:
                return True
            continue
        if tok == src.get("class"):
            return True
        m = re.match(r"(?:((?:GET|POST|PUT|PATCH|DELETE|ANY)(?:\|(?:GET|POST|PUT|PATCH|DELETE|ANY))*)\s+)?(/\S*)$", tok)
        if not m:
            continue
        methods = set(m.group(1).split("|")) if m.group(1) else None
        if methods and row["kind"] not in methods and row["kind"] != "ANY":
            continue
        for pat in _expand_braces(m.group(2)):
            for cand in path_candidates(pat):
                # `/tools/{id}/health` minus its gateway prefix is `{}/health`: a leading wildcard matches
                # far too much, so a stripped candidate must start with a literal segment.
                if cand.split("/")[0] in ("{}", "**", ""):
                    continue
                if pattern_match(row["name"], cand):
                    return True
    return False


def pattern_match(row_path, pattern):
    """A known-gaps path pattern against a product path: `{}` and `**` are wildcards on the pattern
    side only — a product path variable never matches a literal pattern segment."""
    a, b = row_path.split("/"), pattern.split("/")
    if "**" in b:
        b = b[:b.index("**")]
        if len(a) < len(b):
            return False
        a = a[:len(b)]
    elif len(a) != len(b):
        return False
    return all(x == y or y == "{}" for x, y in zip(a, b))


def apply_known_gaps(rows, kgs):
    names = defaultdict(int)
    for r in rows:
        if r["surface"] == "graphql":
            names[r["name"]] += 1
    unique = {n for n, c in names.items() if c == 1}
    counts = defaultdict(int)
    for r in rows:
        r["kg"] = None
        for kg in kgs:
            if kg_matches(r, kg, unique):
                r["kg"] = kg["id"]
                r["kg_class"] = kg["class"]
                counts[kg["id"]] += 1
                break
        r["open"] = r["status"] != "covered" and not r["kg"]
    return dict(counts)


# ----------------------------------------------------------------------------- plan

PLAN_STATUSES = ("proposed", "planned", "in-progress", "done", "dropped")


def load_plan(path):
    if not path or not os.path.exists(path):
        return {"path": path, "items": []}
    import tomllib
    with open(path, "rb") as f:
        data = tomllib.load(f)
    items = []
    for it in data.get("items", []):
        it = dict(it)
        it.setdefault("status", "proposed")
        it.setdefault("priority", "P2")
        for k in ("ops", "depends_on", "needs", "tags"):
            it.setdefault(k, [])
        items.append(it)
    return {"path": path, "items": items}


def effort_class(points):
    return "S" if points <= 4 else "M" if points <= 12 else "L"


def score_plan(plan, rows, tl):
    """Score every plan item against the matrix: coverage, computed status, missing fixtures, effort."""
    by_key = {r["key"]: r for r in rows}
    planned_keys = {k for it in plan["items"] for k in it["ops"]}
    dto = set(tl["dto_classes"])
    test_classes = set(tl["test_classes"])
    const_fields = set()
    for c in tl["gql_constants"].values():
        const_fields |= set(c["fields"])
    scored = []
    for it in plan["items"]:
        ops = [by_key[k] for k in it["ops"] if k in by_key]
        unknown = [k for k in it["ops"] if k not in by_key]
        direct = [r for r in ops if any(t["how"] == "direct" and not t["disabled"] for t in r["tests"])]
        covered = [r for r in ops if r["status"] == "covered"]
        ui = [r for r in ops if r["frontend"]]
        points, missing = 0, defaultdict(int)
        for r in ops:
            if r["status"] == "covered":
                continue
            if r["surface"] == "graphql":
                if r["key"] not in const_fields:
                    points += 1
                    missing["queries_constant"] += 1
                if not r["client_methods"]:
                    points += 1
                    missing["client_method"] += 1
                miss_t = [t for t in r.get("types", []) if t not in dto][:2]
                points += len(miss_t)
                missing["dto"] += len(miss_t)
            elif not r["client_methods"]:
                points += 1
                missing["client_method"] += 1
        tc = it.get("test_class")
        if tc and tc not in test_classes:
            points += 2
            missing["test_class"] = 1
        if ops and len(direct) == len(ops):
            computed = "done"
        elif covered:
            computed = "partial"
        else:
            computed = "open"
        areas = {area_of(r) for r in ops}
        unplanned_in_area = sorted(r["key"] for r in rows if area_of(r) in areas and r["open"] and r["key"] not in planned_keys)
        score = round((len(ui) + 0.25 * (len(ops) - len(ui))) / max(points, 1), 2)
        scored.append({
            "id": it["id"], "title": it.get("title", it["id"]), "status": it["status"], "priority": it["priority"],
            "test_class": tc, "depends_on": it["depends_on"], "needs": it["needs"],
            "ops": [r["key"] for r in ops], "unknown_ops": unknown, "n_ops": len(ops),
            "n_direct": len(direct), "n_covered": len(covered), "n_ui": len(ui),
            "missing_ops": [r["key"] for r in ops if r["status"] != "covered"],
            "computed": computed, "regressed": it["status"] == "done" and computed != "done",
            "effort_points": points, "effort": effort_class(points), "missing": {k: v for k, v in missing.items() if v},
            "score": score, "areas": sorted(areas), "unplanned_in_area": unplanned_in_area,
        })
    done_ids = {s["id"] for s in scored if s["computed"] == "done" or s["status"] == "dropped"}
    for s in scored:
        s["blocked_by"] = [d for d in s["depends_on"] if d not in done_ids]
    unplanned_open_ui = sorted(r["key"] for r in rows if r["open"] and r["frontend"] and r["key"] not in planned_keys)
    unplanned_open_api = sorted(r["key"] for r in rows if r["open"] and not r["frontend"] and r["key"] not in planned_keys)
    prio = {"P1": 0, "P2": 1, "P3": 2}
    active = [s for s in scored if s["computed"] != "done" and s["status"] not in ("done", "dropped") and not s["blocked_by"]]
    order = {"in-progress": 0, "planned": 1, "proposed": 2}
    next_up = sorted(active, key=lambda s: (order.get(s["status"], 3), prio.get(s["priority"], 9), -s["score"]))[:3]
    return {
        "path": plan["path"], "items": scored, "next_up": [s["id"] for s in next_up],
        "unplanned_open_ui": unplanned_open_ui, "unplanned_open_api": unplanned_open_api,
        "plan_ops": sum(s["n_ops"] for s in scored), "plan_ops_direct": sum(s["n_direct"] for s in scored),
        "by_status": {st: sum(1 for s in scored if s["status"] == st) for st in PLAN_STATUSES},
    }


# ----------------------------------------------------------------------------- run history

def totals_of(rows):
    return {
        "ops": len(rows), "covered": sum(1 for r in rows if r["status"] == "covered"),
        "gap_ui": sum(1 for r in rows if r["status"] == "gap-ui"),
        "gap_api": sum(1 for r in rows if r["status"] == "gap-api"),
        "ui_used": sum(1 for r in rows if r["frontend"]),
        "ui_covered": sum(1 for r in rows if r["frontend"] and r["status"] == "covered"),
        "open_ui": sum(1 for r in rows if r["open"] and r["frontend"]),
        "open_api": sum(1 for r in rows if r["open"] and not r["frontend"]),
    }


def update_history(path, entry):
    """Append this run to history.jsonl (one line per date; a rerun on the same date replaces it).
    Returns the most recent earlier entry, for deltas."""
    entries = []
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    earlier = [e for e in entries if e.get("date", "") < entry["date"]]
    previous = max(earlier, key=lambda e: e["date"]) if earlier else None
    if path:
        kept = [e for e in entries if e.get("date") != entry["date"]] + [entry]
        kept.sort(key=lambda e: e.get("date", ""))
        with open(path, "w", encoding="utf-8") as f:
            for e in kept:
                f.write(json.dumps(e, sort_keys=True) + "\n")
    return previous


# ----------------------------------------------------------------------------- join

def build_matrix(product_gql, product_rest, fe, tl):
    cm = tl["client_methods"]
    # op -> {client methods}
    op_methods = defaultdict(set)
    for key, rec in cm.items():
        for g in rec["gql"]:
            op_methods[g].add(key)
        for r in rec["rest"]:
            op_methods[r].add(key)
    # test -> reachable client methods, with how
    test_reach = {}
    for t in tl["tests"]:
        reach = {}
        for k in t["direct"]:
            reach.setdefault(k, "direct")
        for k in t["setup"]:
            reach.setdefault(k, "setup")
        for k in t["base"]:
            reach.setdefault(k, "base")
        for h in t["helpers"]:
            for k in tl["helper_calls"].get(h, []):
                reach.setdefault(k, f"helper:{h}")
        test_reach[(t["class"], t["method"])] = reach
    # op -> tests
    op_tests = defaultdict(list)
    for t in tl["tests"]:
        reach = test_reach[(t["class"], t["method"])]
        seen = set()
        for k, how in reach.items():
            rec = cm.get(k)
            if not rec:
                continue
            for op in list(rec["gql"]) + list(rec["rest"]):
                if op in seen:
                    continue
                seen.add(op)
                op_tests[op].append({"class": t["class"], "method": t["method"], "display": t["display"],
                                     "how": how, "via": k, "disabled": t["disabled"], "assumes": t["assumes"],
                                     "tags": t["tags"]})

    rows = []
    # GraphQL
    for key, rec in sorted(product_gql.items()):
        uses = fe["graphql"].get(key, []) if fe else []
        tests = op_tests.get(key, [])
        r = row("graphql", key, rec["kind"].upper(), rec["name"], rec["sources"], rec.get("introduced"),
                uses, tests, sorted(op_methods.get(key, ())))
        r["types"] = rec.get("types", [])
        rows.append(r)
    # REST
    fe_rest = fe["rest"] if fe else {}
    consumer_rest_keys = set(fe_rest) | set(op_methods)
    matched_consumer = set()
    for ep in product_rest:
        uses, tests, methods = [], [], set()
        for ck in consumer_rest_keys:
            if " " not in ck:
                continue
            cmeth, cpath = ck.split(" ", 1)
            if ep["method"] not in ("ANY", cmeth):
                continue
            if any(paths_match(c, ep["path"]) for c in path_candidates(cpath)):
                matched_consumer.add(ck)
                uses += fe_rest.get(ck, [])
                tests += op_tests.get(ck, [])
                methods |= set(op_methods.get(ck, ()))
        rows.append(row("rest", f"{ep['method']} {ep['path']}", ep["method"], ep["path"],
                        [{"repo": ep["repo"], "module": ep["module"], "file": ep["file"], "class": ep["class"],
                          "handler": ep["handler"], "view": ep["view"]}],
                        ep.get("introduced"), uses, tests, sorted(methods)))
    # consumer-side drift
    product_gql_keys = set(product_gql)
    federation = {"query:_service", "query:_entities"}
    fe_gql_unknown = sorted(k for k in (fe["graphql"] if fe else {}) if k not in product_gql_keys and k not in federation)
    fe_rest_unknown = sorted(k for k in fe_rest if k not in matched_consumer)
    test_gql_unknown = sorted(k for k in op_methods if ":" in k and " " not in k and k not in product_gql_keys)
    test_rest_unknown = sorted(k for k in op_methods if " " in k and k not in matched_consumer)
    # API-client methods that no enabled test reaches (dead or not-yet-used fixtures)
    reached = set()
    for t in tl["tests"]:
        if t["disabled"]:
            continue
        for k in test_reach[(t["class"], t["method"])]:
            reached.add(k)
            reached |= set(cm.get(k, {}).get("calls", ()))
    changed = True
    while changed:  # closure over client-to-client calls
        changed = False
        for k in list(reached):
            for callee in cm.get(k, {}).get("calls", ()):
                if callee in cm and callee not in reached:
                    reached.add(callee)
                    changed = True
    unreached = sorted(k for k, rec in cm.items() if (rec["gql"] or rec["rest"]) and k not in reached)
    return rows, {
        "frontend_graphql_not_in_product": fe_gql_unknown,
        "frontend_rest_not_matched": fe_rest_unknown,
        "tests_graphql_not_in_product": test_gql_unknown,
        "tests_rest_not_matched": test_rest_unknown,
        "client_methods_unreached": unreached,
    }


def row(surface, key, kind, name, sources, introduced, uses, tests, methods):
    live = [t for t in tests if not t["disabled"]]
    if live:
        status = "covered"
    elif tests:
        status = "covered-by-disabled-only"
    elif uses:
        status = "gap-ui"
    else:
        status = "gap-api"
    return {"surface": surface, "key": key, "kind": kind, "name": name, "sources": sources, "introduced": introduced,
            "frontend": uses, "tests": tests, "client_methods": methods, "status": status,
            "n_tests": len(live), "n_ui": len(uses), "types": [],
            "ui_features": sorted({u["feature"] for u in uses}), "kg": None, "open": status != "covered"}


# ----------------------------------------------------------------------------- report

def area_of(r):
    s = r["sources"][0]
    if r["surface"] == "graphql":
        return os.path.basename(s["file"]).replace(".graphqls", "").replace(".graphql", "")
    return s.get("class", "?")


def md_plan_section(plan, entry, previous, kgs, kg_counts):
    L = [f"## Plan ({os.path.basename(plan['path'] or 'no plan file')})\n"]
    t = entry["totals"]
    delta = ""
    if previous:
        pt, pp = previous["totals"], previous.get("plan", {})
        delta = (f" · since {previous['date']}: covered {t['covered'] - pt['covered']:+d}, open UI-used gaps "
                 f"{t['open_ui'] - pt['open_ui']:+d}, plan ops covered directly "
                 f"{plan['plan_ops_direct'] - pp.get('plan_ops_direct', 0):+d}")
    L.append(f"Burndown: {plan['plan_ops']} operations in {len(plan['items'])} items "
             f"({', '.join(f'{k} {v}' for k, v in plan['by_status'].items() if v)}) · covered directly {plan['plan_ops_direct']} · "
             f"open UI-used gaps outside the plan {len(plan['unplanned_open_ui'])} · open API-only gaps outside the plan "
             f"{len(plan['unplanned_open_api'])}{delta}\n")
    L.append("`status` is what the plan file says; `computed` is what the matrix proves (`done` = every op reached by a "
             "direct, enabled test). Effort counts missing fixtures per uncovered op — a Queries constant, a client method, "
             "up to two DTO types — plus 2 for a missing test class; S ≤ 4, M ≤ 12, L above. Score = UI-used ops "
             "(other ops weigh ¼) per effort point; higher first.\n")
    if plan["items"]:
        L.append("| id | title | status | computed | P | direct/ops | UI | effort | score | blocked by | drift |")
        L.append("|---|---|---|---|---|---|---|---|---|---|---|")
        for s in plan["items"]:
            drift = []
            if s["unknown_ops"]:
                drift.append(f"{len(s['unknown_ops'])} unknown op(s)")
            if s["unplanned_in_area"]:
                drift.append(f"{len(s['unplanned_in_area'])} unplanned in area")
            if s["regressed"]:
                drift.append("REGRESSED")
            miss = ", ".join(f"{k} {v}" for k, v in s["missing"].items())
            L.append(f"| {s['id']} | {s['title']} | {s['status']} | {s['computed']} | {s['priority']} | "
                     f"{s['n_direct']}/{s['n_ops']} | {s['n_ui']} | {s['effort']} ({s['effort_points']}: {miss or 'nothing missing'}) | "
                     f"{s['score']} | {', '.join(s['blocked_by']) or ''} | {'; '.join(drift)} |")
        L.append("")
        by_id = {s["id"]: s for s in plan["items"]}
        L.append("**Next up:** " + (", ".join(f"{i} ({by_id[i]['title']}, {by_id[i]['effort']})" for i in plan["next_up"]) or "nothing unblocked") + "\n")
        needs = [(s["id"], n) for s in plan["items"] if s["status"] in ("proposed", "planned", "in-progress") for n in s["needs"]]
        if needs:
            L.append("**Preconditions and decisions the items wait on:**")
            for i, n in needs:
                L.append(f"- {i}: {n}")
            L.append("")
    if plan["unplanned_open_ui"]:
        L.append(f"**Open UI-used gaps in no plan item ({len(plan['unplanned_open_ui'])}):** "
                 + ", ".join(f"`{k}`" for k in plan["unplanned_open_ui"][:40])
                 + (" …" if len(plan["unplanned_open_ui"]) > 40 else "") + "\n")
    if kgs:
        applied = [f"{kg['id']} {kg['class'].split('(')[0].lower()} ({kg_counts.get(kg['id'], 0)})" for kg in kgs if kg_counts.get(kg["id"])]
        L.append("**Known gaps applied (rows excluded from the open lists):** " + (" · ".join(applied) or "none") + "\n")
    return L


def md_report(rows, drift, meta, fe, tl, recent_days, plan=None, entry=None, previous=None, kgs=(), kg_counts=None):
    L = []
    kg_counts = kg_counts or {}
    key_items = defaultdict(list)
    if plan:
        for s in plan["items"]:
            for k in s["ops"]:
                key_items[k].append(s["id"])
    since = (date.today() - timedelta(days=recent_days)).isoformat()
    L.append(f"# API test-coverage matrix — {meta['generated'][:10]}\n")
    L.append("Refs: " + " · ".join(f"{k} `{v[:9]}`" for k, v in meta["refs"].items()) + "\n")
    L.append("Status: `covered` = at least one enabled test reaches the operation (directly, via setup/base "
             "class, via a helper, or via another API-client method) · `gap-ui` = the dashboard app uses it and "
             "no test reaches it · `gap-api` = neither the app nor a test touches it · "
             "`covered-by-disabled-only` = only `@Disabled` tests reach it.\n")

    def totals(sub):
        c = defaultdict(int)
        for r in sub:
            c[r["status"]] += 1
        n = len(sub)
        ui = sum(1 for r in sub if r["frontend"])
        ui_cov = sum(1 for r in sub if r["frontend"] and r["status"] == "covered")
        return n, c, ui, ui_cov

    L.append("## Totals\n")
    L.append("| surface | operations | covered | gap-ui | gap-api | disabled-only | used by UI | UI-used & covered |")
    L.append("|---|---|---|---|---|---|---|---|")
    for surface, label in (("graphql", "GraphQL fields"), ("rest", "REST endpoints")):
        sub = [r for r in rows if r["surface"] == surface]
        n, c, ui, ui_cov = totals(sub)
        L.append(f"| {label} | {n} | {c['covered']} | {c['gap-ui']} | {c['gap-api']} | {c['covered-by-disabled-only']} | {ui} | {ui_cov} |")
    n, c, ui, ui_cov = totals(rows)
    L.append(f"| **all** | {n} | {c['covered']} | {c['gap-ui']} | {c['gap-api']} | {c['covered-by-disabled-only']} | {ui} | {ui_cov} |\n")
    open_ui = [r for r in rows if r["status"] == "gap-ui" and r["open"]]
    open_api = [r for r in rows if r["status"] == "gap-api" and r["open"]]
    L.append(f"After known gaps: **{len(open_ui)}** open UI-used gaps and **{len(open_api)}** open API-only gaps "
             f"({sum(kg_counts.values())} rows matched a known-gaps entry).\n")

    if plan is not None and entry is not None:
        L += md_plan_section(plan, entry, previous, kgs, kg_counts)

    # per-area table
    L.append("## By area\n")
    L.append("Area = schema file for GraphQL, controller class for REST. `UI` = operations the app uses; `cov` = covered.\n")
    L.append("| surface | area | module | ops | UI | cov | gap-ui | gap-api |")
    L.append("|---|---|---|---|---|---|---|---|")
    areas = defaultdict(list)
    for r in rows:
        areas[(r["surface"], area_of(r), r["sources"][0]["module"])].append(r)
    for (surface, area, module), sub in sorted(areas.items(), key=lambda kv: (-sum(1 for r in kv[1] if r["status"] == "gap-ui"), kv[0])):
        ac = defaultdict(int)
        for r in sub:
            ac[r["status"]] += 1
        L.append(f"| {surface} | {area} | {module} | {len(sub)} | {sum(1 for r in sub if r['frontend'])} | {ac['covered']} | {ac['gap-ui']} | {ac['gap-api']} |")
    L.append("")

    def fmt_sources(r):
        s = r["sources"][0]
        if r["surface"] == "graphql":
            return f"{s['module']}/…/{os.path.basename(s['file'])}"
        return f"{s['module']} `{s['class']}.{s['handler']}`"

    L.append(f"## Gap: used by the UI, not reached by any test ({len(open_ui)} open, {c['gap-ui'] - len(open_ui)} under known gaps)\n")
    L.append("| op | area | module | UI features | introduced | plan |")
    L.append("|---|---|---|---|---|---|")
    for r in sorted(open_ui, key=lambda r: (area_of(r), r["key"])):
        L.append(f"| `{r['key']}` | {area_of(r)} | {r['sources'][0]['module']} | {', '.join(r['ui_features'])} | {r['introduced'] or ''} | {', '.join(key_items.get(r['key'], []))} |")
    L.append("")

    recent = [r for r in rows if r["introduced"] and r["introduced"] >= since and r["status"] != "covered"]
    L.append(f"## Recently added ({recent_days} days, since {since}) and not covered ({len(recent)})\n")
    L.append("Approximate: the date is the first commit whose diff introduced the field/mapping line in that file.\n")
    L.append("| op | status | introduced | area | known gap | plan |")
    L.append("|---|---|---|---|---|---|")
    for r in sorted(recent, key=lambda r: r["introduced"], reverse=True):
        L.append(f"| `{r['key']}` | {r['status']} | {r['introduced']} | {area_of(r)} | {r['kg'] or ''} | {', '.join(key_items.get(r['key'], []))} |")
    L.append("")

    L.append(f"## Gap: not used by the UI and not tested ({len(open_api)} open, {c['gap-api'] - len(open_api)} under known gaps)\n")
    L.append("API-only surface (external API, agent, auth flows, internal, view controllers, proxies) not matched by `known-gaps.md`.\n")
    L.append("| op | area | module | plan |")
    L.append("|---|---|---|---|")
    for r in sorted(open_api, key=lambda r: (r["sources"][0]["module"], area_of(r), r["key"])):
        L.append(f"| `{r['key']}` | {area_of(r)} | {r['sources'][0]['module']} | {', '.join(key_items.get(r['key'], []))} |")
    L.append("")

    dis = [r for r in rows if r["status"] == "covered-by-disabled-only"]
    if dis:
        L.append(f"## Reached only by disabled tests ({len(dis)})\n")
        for r in dis:
            L.append(f"- `{r['key']}` — " + "; ".join(f"{t['class']}.{t['method']}" for t in r["tests"]))
        L.append("")

    L.append("## Covered operations and the tests that reach them\n")
    L.append("`direct` = the test body calls the client method; other values say through what it is reached.\n")
    L.append("| op | tests | via |")
    L.append("|---|---|---|")
    for r in sorted([r for r in rows if r["status"] == "covered"], key=lambda r: (r["surface"], area_of(r), r["key"])):
        live = [t for t in r["tests"] if not t["disabled"]]
        direct = [t for t in live if t["how"] == "direct"]
        sample = ", ".join(sorted({t["display"] for t in (direct or live)})[:4])
        more = len({t["display"] for t in live}) - min(4, len({t["display"] for t in (direct or live)}))
        hows = sorted({t["how"].split(":")[0] for t in live})
        L.append(f"| `{r['key']}` | {sample}{f' (+{more})' if more > 0 else ''} | {', '.join(hows)} |")
    L.append("")

    L.append("## Drift\n")
    L.append("Operations a consumer calls that do not resolve to a product operation at the analysed refs. "
             "Either the consumer is ahead/behind the product, the call targets a third-party or proxied surface, "
             "or the extractor could not resolve the path.\n")
    for k, label in (("frontend_graphql_not_in_product", "UI GraphQL fields not in any product schema"),
                     ("frontend_rest_not_matched", "UI REST calls not matching any product endpoint"),
                     ("tests_graphql_not_in_product", "Test GraphQL fields not in any product schema"),
                     ("tests_rest_not_matched", "Test REST calls not matching any product endpoint")):
        L.append(f"**{label} ({len(drift[k])})**: " + (", ".join(f"`{x}`" for x in drift[k]) if drift[k] else "none") + "\n")

    L.append(f"**API-client methods that call an operation but that no enabled test reaches ({len(drift['client_methods_unreached'])})**: "
             + (", ".join(f"`{x}`" for x in drift["client_methods_unreached"]) or "none") + "\n")

    if fe:
        L.append("## Frontend schema cross-check\n")
        fe_q, fe_m = set(fe["schema_roots"]["query"]), set(fe["schema_roots"]["mutation"])
        pq = {r["name"] for r in rows if r["surface"] == "graphql" and r["kind"] == "QUERY"}
        pm = {r["name"] for r in rows if r["surface"] == "graphql" and r["kind"] == "MUTATION"}
        L.append(f"`schema.graphql` in the app has {len(fe_q)} query and {len(fe_m)} mutation fields; the product schemas "
                 f"have {len(pq)} and {len(pm)}. In the app schema but not in the product: "
                 + (", ".join(f"`{x}`" for x in sorted((fe_q - pq) | (fe_m - pm))) or "none") + ".\n")

    L.append("## Test inventory summary\n")
    tests = tl["tests"]
    L.append(f"{len(tests)} `@Test` methods in {len({t['class'] for t in tests})} classes; "
             f"{sum(1 for t in tests if t['disabled'])} disabled; {sum(1 for t in tests if t['assumes'])} contain an assumption "
             f"(may self-skip); {sum(1 for t in tests if not t['direct'] and not t['setup'] and not t['base'] and not t['helpers'])} "
             f"reach no API client at all (UI or assistant-conversation tests).\n")
    return "\n".join(L)


# ----------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=os.path.expanduser("~/sandbox/flamingo"), help="folder holding the repo clones")
    ap.add_argument("--ref", default="origin/main", help="ref for the product repositories and the frontend")
    ap.add_argument("--test-ref", default=None, help="ref for the test library (default: --ref)")
    ap.add_argument("--frontend-ref", default=None, help="ref for openframe-oss-frontend (default: --ref)")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--no-history", action="store_true", help="skip per-operation 'introduced' dates (faster)")
    ap.add_argument("--recent-days", type=int, default=30)
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--plan", default=os.path.join(here, "coverage-plan.toml"), help="plan file (TOML) to score")
    ap.add_argument("--known-gaps", default=os.path.join(here, "known-gaps.md"), help="known-gaps file to apply")
    ap.add_argument("--history-log", default=os.path.join(here, "history.jsonl"), help="one line per run, for deltas")
    ap.add_argument("--no-history-log", action="store_true", help="do not read or write the history log")
    ap.add_argument("--run-date", default=date.today().isoformat(), help="date key for the history log")
    args = ap.parse_args()

    root = os.path.expanduser(args.root)
    refs = {}
    for repo in PRODUCT_REPOS + [FRONTEND_REPO]:
        rp = os.path.join(root, repo)
        if os.path.isdir(os.path.join(rp, ".git")):
            ref = args.frontend_ref if (repo == FRONTEND_REPO and args.frontend_ref) else args.ref
            refs[repo] = resolve_ref(rp, ref)
        else:
            print(f"warning: {rp} not found; skipped", file=sys.stderr)
    test_ref = args.test_ref or args.ref
    refs["tests"] = resolve_ref(os.path.join(root, TEST_REPO), test_ref)

    t0 = datetime.now()
    print("product GraphQL …", file=sys.stderr)
    pg = product_graphql(root, refs, not args.no_history)
    print(f"  {len(pg)} operations", file=sys.stderr)
    print("product REST …", file=sys.stderr)
    pr = product_rest(root, refs, not args.no_history)
    print(f"  {len(pr)} endpoints", file=sys.stderr)
    print("frontend …", file=sys.stderr)
    fe = frontend_inventory(root, refs[FRONTEND_REPO]) if FRONTEND_REPO in refs else None
    if fe:
        print(f"  {fe['op_documents']} operation documents, {len(fe['graphql'])} root fields, {len(fe['rest'])} REST calls", file=sys.stderr)
    print("tests …", file=sys.stderr)
    tl = test_inventory(root, refs["tests"])
    print(f"  {len(tl['tests'])} tests, {len(tl['client_methods'])} client methods, {len(tl['gql_constants'])} GraphQL documents", file=sys.stderr)
    rows, drift = build_matrix(pg, pr, fe, tl)
    kgs = parse_known_gaps(args.known_gaps)
    kg_counts = apply_known_gaps(rows, kgs)
    plan = score_plan(load_plan(args.plan), rows, tl)
    print(f"known gaps: {len(kgs)} entries matched {sum(kg_counts.values())} rows · plan: {len(plan['items'])} items, "
          f"{plan['plan_ops_direct']}/{plan['plan_ops']} ops covered directly", file=sys.stderr)

    meta = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "refs": refs,
            "root": root, "recent_days": args.recent_days, "duration_s": round((datetime.now() - t0).total_seconds(), 1)}
    entry = {"date": args.run_date, "generated": meta["generated"], "refs": refs, "totals": totals_of(rows),
             "plan": {"items": len(plan["items"]), "by_status": plan["by_status"], "plan_ops": plan["plan_ops"],
                      "plan_ops_direct": plan["plan_ops_direct"], "unplanned_open_ui": len(plan["unplanned_open_ui"])}}
    previous = update_history(None if args.no_history_log else args.history_log, entry)
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "coverage.json"), "w") as f:
        json.dump({"meta": meta, "rows": rows, "drift": drift, "plan": plan, "known_gaps": kgs,
                   "known_gaps_counts": kg_counts, "previous_run": previous, "totals": entry["totals"],
                   "frontend": {"ref": refs.get(FRONTEND_REPO), "rest_calls": fe["rest"] if fe else {},
                                "schema_roots": fe["schema_roots"] if fe else {}},
                   "tests": tl}, f, indent=1, default=sorted)
    with open(os.path.join(args.out, "coverage.md"), "w") as f:
        f.write(md_report(rows, drift, meta, fe, tl, args.recent_days, plan, entry, previous, kgs, kg_counts))
    c = defaultdict(int)
    for r in rows:
        c[r["status"]] += 1
    print(f"wrote {args.out}/coverage.md and coverage.json — {len(rows)} operations: {dict(c)} in {meta['duration_s']}s", file=sys.stderr)


if __name__ == "__main__":
    main()
