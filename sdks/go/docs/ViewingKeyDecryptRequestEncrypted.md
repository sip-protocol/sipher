# ViewingKeyDecryptRequestEncrypted

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Ciphertext** | **string** |  | 
**Nonce** | **string** |  | 
**ViewingKeyHash** | **string** | 0x-prefixed 32-byte hex string | 

## Methods

### NewViewingKeyDecryptRequestEncrypted

`func NewViewingKeyDecryptRequestEncrypted(ciphertext string, nonce string, viewingKeyHash string, ) *ViewingKeyDecryptRequestEncrypted`

NewViewingKeyDecryptRequestEncrypted instantiates a new ViewingKeyDecryptRequestEncrypted object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewViewingKeyDecryptRequestEncryptedWithDefaults

`func NewViewingKeyDecryptRequestEncryptedWithDefaults() *ViewingKeyDecryptRequestEncrypted`

NewViewingKeyDecryptRequestEncryptedWithDefaults instantiates a new ViewingKeyDecryptRequestEncrypted object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCiphertext

`func (o *ViewingKeyDecryptRequestEncrypted) GetCiphertext() string`

GetCiphertext returns the Ciphertext field if non-nil, zero value otherwise.

### GetCiphertextOk

`func (o *ViewingKeyDecryptRequestEncrypted) GetCiphertextOk() (*string, bool)`

GetCiphertextOk returns a tuple with the Ciphertext field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCiphertext

`func (o *ViewingKeyDecryptRequestEncrypted) SetCiphertext(v string)`

SetCiphertext sets Ciphertext field to given value.


### GetNonce

`func (o *ViewingKeyDecryptRequestEncrypted) GetNonce() string`

GetNonce returns the Nonce field if non-nil, zero value otherwise.

### GetNonceOk

`func (o *ViewingKeyDecryptRequestEncrypted) GetNonceOk() (*string, bool)`

GetNonceOk returns a tuple with the Nonce field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNonce

`func (o *ViewingKeyDecryptRequestEncrypted) SetNonce(v string)`

SetNonce sets Nonce field to given value.


### GetViewingKeyHash

`func (o *ViewingKeyDecryptRequestEncrypted) GetViewingKeyHash() string`

GetViewingKeyHash returns the ViewingKeyHash field if non-nil, zero value otherwise.

### GetViewingKeyHashOk

`func (o *ViewingKeyDecryptRequestEncrypted) GetViewingKeyHashOk() (*string, bool)`

GetViewingKeyHashOk returns a tuple with the ViewingKeyHash field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKeyHash

`func (o *ViewingKeyDecryptRequestEncrypted) SetViewingKeyHash(v string)`

SetViewingKeyHash sets ViewingKeyHash field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


