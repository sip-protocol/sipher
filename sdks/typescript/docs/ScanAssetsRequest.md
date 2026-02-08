
# ScanAssetsRequest


## Properties

Name | Type
------------ | -------------
`address` | string
`displayOptions` | [ScanAssetsRequestDisplayOptions](ScanAssetsRequestDisplayOptions.md)
`page` | number
`limit` | number

## Example

```typescript
import type { ScanAssetsRequest } from '@sip-protocol/sipher-client'

// TODO: Update the object below with actual values
const example = {
  "address": S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at,
  "displayOptions": null,
  "page": null,
  "limit": null,
} satisfies ScanAssetsRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ScanAssetsRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


