---
title: "{{ replace .Name "-" " " | title }}"
summary:
description: "{{ .Name }}"
keywords: "{{replace .Name "-" ","}}"

date: {{ time.Format "2023-10-15T13:18:50" time.Now}}
lastmod: {{ time.Format "2023-10-15T13:18:50" time.Now}}

math: false
mermaid: true

categories:
  - {{ replace (replace .File.Dir `post\` ``) `\` ``}}
tags:
  -
  -
---
