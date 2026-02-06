# CsplTransferRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CsplMint** | **string** | C-SPL token mint identifier | 
**From** | **string** | Base58-encoded Solana public key | 
**To** | **string** | Base58-encoded Solana public key | 
**EncryptedAmount** | **string** | Encrypted transfer amount as hex | 
**Memo** | Pointer to **string** | Optional memo | [optional] 

## Methods

### NewCsplTransferRequest

`func NewCsplTransferRequest(csplMint string, from string, to string, encryptedAmount string, ) *CsplTransferRequest`

NewCsplTransferRequest instantiates a new CsplTransferRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCsplTransferRequestWithDefaults

`func NewCsplTransferRequestWithDefaults() *CsplTransferRequest`

NewCsplTransferRequestWithDefaults instantiates a new CsplTransferRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCsplMint

`func (o *CsplTransferRequest) GetCsplMint() string`

GetCsplMint returns the CsplMint field if non-nil, zero value otherwise.

### GetCsplMintOk

`func (o *CsplTransferRequest) GetCsplMintOk() (*string, bool)`

GetCsplMintOk returns a tuple with the CsplMint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCsplMint

`func (o *CsplTransferRequest) SetCsplMint(v string)`

SetCsplMint sets CsplMint field to given value.


### GetFrom

`func (o *CsplTransferRequest) GetFrom() string`

GetFrom returns the From field if non-nil, zero value otherwise.

### GetFromOk

`func (o *CsplTransferRequest) GetFromOk() (*string, bool)`

GetFromOk returns a tuple with the From field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFrom

`func (o *CsplTransferRequest) SetFrom(v string)`

SetFrom sets From field to given value.


### GetTo

`func (o *CsplTransferRequest) GetTo() string`

GetTo returns the To field if non-nil, zero value otherwise.

### GetToOk

`func (o *CsplTransferRequest) GetToOk() (*string, bool)`

GetToOk returns a tuple with the To field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTo

`func (o *CsplTransferRequest) SetTo(v string)`

SetTo sets To field to given value.


### GetEncryptedAmount

`func (o *CsplTransferRequest) GetEncryptedAmount() string`

GetEncryptedAmount returns the EncryptedAmount field if non-nil, zero value otherwise.

### GetEncryptedAmountOk

`func (o *CsplTransferRequest) GetEncryptedAmountOk() (*string, bool)`

GetEncryptedAmountOk returns a tuple with the EncryptedAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEncryptedAmount

`func (o *CsplTransferRequest) SetEncryptedAmount(v string)`

SetEncryptedAmount sets EncryptedAmount field to given value.


### GetMemo

`func (o *CsplTransferRequest) GetMemo() string`

GetMemo returns the Memo field if non-nil, zero value otherwise.

### GetMemoOk

`func (o *CsplTransferRequest) GetMemoOk() (*string, bool)`

GetMemoOk returns a tuple with the Memo field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMemo

`func (o *CsplTransferRequest) SetMemo(v string)`

SetMemo sets Memo field to given value.

### HasMemo

`func (o *CsplTransferRequest) HasMemo() bool`

HasMemo returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


