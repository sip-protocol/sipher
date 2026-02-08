
# ScanAssets200ResponseData


## Properties

Name | Type
------------ | -------------
`assets` | [Array&lt;ScanAssets200ResponseDataAssetsInner&gt;](ScanAssets200ResponseDataAssetsInner.md)
`total` | number
`page` | number
`limit` | number
`provider` | string

## Example

```typescript
import type { ScanAssets200ResponseData } from '@sip-protocol/sipher-client'

// TODO: Update the object below with actual values
const example = {
  "assets": null,
  "total": null,
  "page": null,
  "limit": null,
  "provider": null,
} satisfies ScanAssets200ResponseData

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ScanAssets200ResponseData
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


