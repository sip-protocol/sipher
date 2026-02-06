# CsplWrap200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Signature** | Pointer to **string** | Transaction signature | [optional] 
**CsplMint** | Pointer to **string** | Confidential token mint address | [optional] 
**EncryptedBalance** | Pointer to **string** | Encrypted balance as hex | [optional] 
**Token** | Pointer to **map[string]interface{}** | C-SPL token metadata | [optional] 

## Methods

### NewCsplWrap200ResponseData

`func NewCsplWrap200ResponseData() *CsplWrap200ResponseData`

NewCsplWrap200ResponseData instantiates a new CsplWrap200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCsplWrap200ResponseDataWithDefaults

`func NewCsplWrap200ResponseDataWithDefaults() *CsplWrap200ResponseData`

NewCsplWrap200ResponseDataWithDefaults instantiates a new CsplWrap200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSignature

`func (o *CsplWrap200ResponseData) GetSignature() string`

GetSignature returns the Signature field if non-nil, zero value otherwise.

### GetSignatureOk

`func (o *CsplWrap200ResponseData) GetSignatureOk() (*string, bool)`

GetSignatureOk returns a tuple with the Signature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSignature

`func (o *CsplWrap200ResponseData) SetSignature(v string)`

SetSignature sets Signature field to given value.

### HasSignature

`func (o *CsplWrap200ResponseData) HasSignature() bool`

HasSignature returns a boolean if a field has been set.

### GetCsplMint

`func (o *CsplWrap200ResponseData) GetCsplMint() string`

GetCsplMint returns the CsplMint field if non-nil, zero value otherwise.

### GetCsplMintOk

`func (o *CsplWrap200ResponseData) GetCsplMintOk() (*string, bool)`

GetCsplMintOk returns a tuple with the CsplMint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCsplMint

`func (o *CsplWrap200ResponseData) SetCsplMint(v string)`

SetCsplMint sets CsplMint field to given value.

### HasCsplMint

`func (o *CsplWrap200ResponseData) HasCsplMint() bool`

HasCsplMint returns a boolean if a field has been set.

### GetEncryptedBalance

`func (o *CsplWrap200ResponseData) GetEncryptedBalance() string`

GetEncryptedBalance returns the EncryptedBalance field if non-nil, zero value otherwise.

### GetEncryptedBalanceOk

`func (o *CsplWrap200ResponseData) GetEncryptedBalanceOk() (*string, bool)`

GetEncryptedBalanceOk returns a tuple with the EncryptedBalance field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEncryptedBalance

`func (o *CsplWrap200ResponseData) SetEncryptedBalance(v string)`

SetEncryptedBalance sets EncryptedBalance field to given value.

### HasEncryptedBalance

`func (o *CsplWrap200ResponseData) HasEncryptedBalance() bool`

HasEncryptedBalance returns a boolean if a field has been set.

### GetToken

`func (o *CsplWrap200ResponseData) GetToken() map[string]interface{}`

GetToken returns the Token field if non-nil, zero value otherwise.

### GetTokenOk

`func (o *CsplWrap200ResponseData) GetTokenOk() (*map[string]interface{}, bool)`

GetTokenOk returns a tuple with the Token field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetToken

`func (o *CsplWrap200ResponseData) SetToken(v map[string]interface{})`

SetToken sets Token field to given value.

### HasToken

`func (o *CsplWrap200ResponseData) HasToken() bool`

HasToken returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


