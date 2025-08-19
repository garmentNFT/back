// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol"; // 숫자(가격)를 문자열로 변환하기 위해 추가

/**
 * @title TeeNFT (v5 - Price & Redeem Update)
 * @dev 가격 정보 저장 및 교환 기능이 추가된 TeeNFT 컨트랙트.
 */
contract TeeNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    enum Status {
        Redeemable, // 0: 교환 가능
        Redeemed  // 1: 교환 완료
    }

    // --- 변경점 1: TeeNFTData 구조체에 가격(price) 필드 추가 ---
    struct TeeNFTData {
        address creator;
        uint256 createdAt;
        Status status;
        uint256 price; // 가격을 저장할 변수 (wei 단위)
    }

    mapping(uint256 => TeeNFTData) private _teeNFTData;

    constructor(address initialOwner)
        ERC721("TeeNFT", "TNFT")
        Ownable(initialOwner)
    {}

    // --- 변경점 2: safeMint 함수에 가격(_price) 파라미터 추가 ---
    function safeMint(address to, string memory _tokenURI, uint256 _price)
        public
        onlyOwner // 실제 서비스에서는 이 부분을 수정하여 특정 권한을 가진 사용자만 민팅하도록 변경할 수 있습니다.
        returns (uint256)
    {
        uint256 newItemId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, newItemId);
        _setTokenURI(newItemId, _tokenURI);

        // --- 변경점 3: 민팅 시 가격 정보도 함께 저장 ---
        _teeNFTData[newItemId] = TeeNFTData({
            creator: to,
            createdAt: block.timestamp,
            status: Status.Redeemable,
            price: _price // 입력받은 가격을 저장
        });

        return newItemId;
    }

    /**
     * @dev NFT 소유자가 실물 티셔츠로 교환할 때 호출하는 함수.
     * 호출 시 상태를 'Redeemed'로 변경하여 중복 교환을 방지합니다.
     */
    function redeem(uint256 tokenId) public {
        // 이 함수는 'msg.sender'가 아닌 'ownerOf(tokenId)'를 확인해야 합니다.
        // 누군가에게 전송 승인(approve)을 해준 상태에서, 원래 주인이 redeem을 시도하는 경우를 방지합니다.
        require(ownerOf(tokenId) == _msgSender(), "TeeNFT: Caller is not the owner");
        require(_teeNFTData[tokenId].status == Status.Redeemable, "TeeNFT: This token has already been redeemed");

        _teeNFTData[tokenId].status = Status.Redeemed;
    }

    // --- 변경점 4: getTeeNFTData 함수가 가격(price) 정보도 반환하도록 수정 ---
    function getTeeNFTData(uint256 tokenId)
        public
        view
        returns (address creator, uint256 createdAt, Status status, uint256 price)
    {
        TeeNFTData memory data = _teeNFTData[tokenId];
        return (data.creator, data.createdAt, data.status, data.price);
    }
}