
# StealthCheckRequest


## Properties

Name | Type
------------ | -------------
`stealthAddress` | [StealthAddress](StealthAddress.md)
`viewingPrivateKey` | string
`spendingPublicKey` | string

## Example

```typescript
import type { StealthCheckRequest } from '@sip-protocol/sipher-client'

// TODO: Update the object below with actual values
const example = {
  "stealthAddress": null,
  "viewingPrivateKey": 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,
  "spendingPublicKey": 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,
} satisfies StealthCheckRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as StealthCheckRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


